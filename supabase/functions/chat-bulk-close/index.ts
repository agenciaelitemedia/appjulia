// ============================================
// chat-bulk-close
// Preview and commit bulk closing of conversations.
// Filters: client_id, opened_at range, queue_id, scope (julia/human/all).
// Writes per-conversation history entries + dedicated audit log rows.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Scope = 'all' | 'julia' | 'human';

interface Body {
  action: 'preview' | 'commit';
  client_id: string;
  start: string; // ISO
  end: string;   // ISO
  scope: Scope;
  queue_id?: string | null;
  actor_identifier?: string | null;
  actor_name?: string | null;
  actor_user_id?: number | null;
}

const BATCH_SIZE = 200;

function isISO(d: unknown): d is string {
  return typeof d === 'string' && !Number.isNaN(Date.parse(d));
}

function validate(body: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' };
  if (body.action !== 'preview' && body.action !== 'commit') return { ok: false, error: 'invalid action' };
  if (typeof body.client_id !== 'string' || !body.client_id.trim()) return { ok: false, error: 'invalid client_id' };
  if (!isISO(body.start) || !isISO(body.end)) return { ok: false, error: 'invalid date range' };
  if (Date.parse(body.start) > Date.parse(body.end)) return { ok: false, error: 'start > end' };
  if (!['all', 'julia', 'human'].includes(body.scope)) return { ok: false, error: 'invalid scope' };
  if (body.queue_id != null && typeof body.queue_id !== 'string') return { ok: false, error: 'invalid queue_id' };
  return { ok: true, data: body as Body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let parsed: any;
  try { parsed = await req.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const v = validate(parsed);
  if (!v.ok) return json({ error: v.error }, 400);
  const body = v.data;

  try {
    if (body.action === 'preview') {
      const result = await runPreview(supabase, body);
      return json(result, 200);
    }
    const result = await runCommit(supabase, body);
    return json(result, 200);
  } catch (err) {
    console.error('chat-bulk-close error:', err);
    return json({ error: String(err?.message || err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function applyFilters(query: any, body: Body) {
  query = query
    .eq('client_id', body.client_id)
    .in('status', ['open', 'pending'])
    .gte('opened_at', body.start)
    .lte('opened_at', body.end);
  if (body.queue_id) query = query.eq('queue_id', body.queue_id);
  if (body.scope === 'julia') query = query.is('assigned_to', null);
  if (body.scope === 'human') query = query.not('assigned_to', 'is', null);
  return query;
}

async function runPreview(supabase: any, body: Body) {
  // Fetch lightweight rows in pages (up to 5000) just to aggregate.
  const all: Array<{ id: string; queue_id: string | null; assigned_to: string | null; opened_at: string }> = [];
  const PAGE = 1000;
  let from = 0;
  // Safety cap to avoid runaway memory
  const MAX = 20000;
  while (from < MAX) {
    let q = supabase
      .from('chat_conversations')
      .select('id, queue_id, assigned_to, opened_at')
      .order('opened_at', { ascending: true })
      .range(from, from + PAGE - 1);
    q = applyFilters(q, body);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const byAssignment = { julia: 0, human: 0 };
  const byQueue: Record<string, number> = {};
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const r of all) {
    if (r.assigned_to && r.assigned_to.trim()) byAssignment.human++;
    else byAssignment.julia++;
    const k = r.queue_id ?? 'sem_fila';
    byQueue[k] = (byQueue[k] ?? 0) + 1;
    if (!oldest || r.opened_at < oldest) oldest = r.opened_at;
    if (!newest || r.opened_at > newest) newest = r.opened_at;
  }

  return {
    total: all.length,
    capped: all.length >= MAX,
    byAssignment,
    byQueue,
    oldest,
    newest,
  };
}

async function runCommit(supabase: any, body: Body) {
  const batchId = crypto.randomUUID();
  const actorName = (body.actor_name ?? 'Sistema').toString();
  const actorIdent = body.actor_identifier ?? null;
  const actorUserId =
    body.actor_user_id != null && Number.isFinite(Number(body.actor_user_id))
      ? Number(body.actor_user_id)
      : null;
  const filtersJson = {
    start: body.start,
    end: body.end,
    scope: body.scope,
    queue_id: body.queue_id ?? null,
  };

  let closed = 0;
  let skipped = 0;

  // Loop: fetch next batch of candidate IDs, update them with status guard,
  // then insert history + audit rows for the ones actually closed.
  // Hard cap iterations as safety net.
  for (let iter = 0; iter < 200; iter++) {
    let q = supabase
      .from('chat_conversations')
      .select('id, queue_id, contact_id, assigned_to, status, protocol')
      .order('opened_at', { ascending: true })
      .limit(BATCH_SIZE);
    q = applyFilters(q, body);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const ids = rows.map((r: any) => r.id);
    const closeNote = `Encerrado em lote por ${actorName}`;
    const { data: updated, error: upErr } = await supabase
      .from('chat_conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        close_reason: 'bulk_close',
        close_note: closeNote,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .in('status', ['open', 'pending'])
      .select('id');
    if (upErr) throw upErr;

    const updatedSet = new Set((updated ?? []).map((r: any) => r.id));
    const closedRows = rows.filter((r: any) => updatedSet.has(r.id));
    skipped += rows.length - closedRows.length;

    if (closedRows.length > 0) {
      const now = new Date().toISOString();
      const historyRows = closedRows.map((r: any) => ({
        conversation_id: r.id,
        action: 'bulk_closed',
        actor_name: actorName,
        user_id: actorUserId,
        from_value: r.status,
        to_value: 'closed',
        notes: `Encerrado em lote por ${actorName} (batch ${batchId})`,
        created_at: now,
      }));
      const { error: hErr } = await supabase
        .from('chat_conversation_history')
        .insert(historyRows);
      if (hErr) throw hErr;

      const logRows = closedRows.map((r: any) => ({
        client_id: body.client_id,
        actor_identifier: actorIdent,
        actor_name: actorName,
        conversation_id: r.id,
        protocol: r.protocol,
        contact_id: r.contact_id,
        queue_id: r.queue_id,
        assignment_type: r.assigned_to && r.assigned_to.trim() ? 'human' : 'julia',
        previous_status: r.status,
        previous_assigned_to: r.assigned_to,
        batch_id: batchId,
        filters: filtersJson,
      }));
      const { error: lErr } = await supabase
        .from('chat_bulk_close_logs')
        .insert(logRows);
      if (lErr) throw lErr;

      closed += closedRows.length;
    }

    // If we processed fewer than a full page, no more candidates remain.
    if (rows.length < BATCH_SIZE) break;
  }

  return { batch_id: batchId, closed, skipped };
}
