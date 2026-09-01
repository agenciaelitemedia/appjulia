// ============================================
// chat-bulk-transfer
// Preview and commit bulk transfer of conversations.
// Targets: assign to a single agent, or return to queue (unassign).
// Filters: client_id, opened_at range (optional), queue_id,
//          current assignee (all | unassigned | specific name), statuses.
// Writes per-conversation history entries for auditing.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  agentIdentifier,
  capacityBlockedMessage,
  checkCapacity,
  type CapacityInfo,
} from '../_shared/chat/capacity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ConvStatus = 'open' | 'pending';

interface Target {
  type: 'assign' | 'return_queue';
  assigned_to?: string | null;
  assigned_user_id?: number | null;
}

interface Body {
  action: 'preview' | 'commit';
  client_id: string;
  start?: string | null;
  end?: string | null;
  queue_id?: string | null;
  /** 'all' | 'unassigned' | '<nome do responsável atual>' */
  current_assignee?: string | null;
  statuses: ConvStatus[];
  target: Target;
  actor_name?: string | null;
  actor_user_id?: number | null;
}

const BATCH_SIZE = 200;
const MAX = 20000;

function isISO(d: unknown): boolean {
  return typeof d === 'string' && !Number.isNaN(Date.parse(d));
}

function validate(body: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' };
  if (body.action !== 'preview' && body.action !== 'commit') return { ok: false, error: 'invalid action' };
  if (typeof body.client_id !== 'string' || !body.client_id.trim()) return { ok: false, error: 'invalid client_id' };
  if (body.start != null && !isISO(body.start)) return { ok: false, error: 'invalid start' };
  if (body.end != null && !isISO(body.end)) return { ok: false, error: 'invalid end' };
  if (body.start && body.end && Date.parse(body.start) > Date.parse(body.end)) {
    return { ok: false, error: 'start > end' };
  }
  if (body.queue_id != null && typeof body.queue_id !== 'string') return { ok: false, error: 'invalid queue_id' };
  if (body.current_assignee != null && typeof body.current_assignee !== 'string') {
    return { ok: false, error: 'invalid current_assignee' };
  }
  const statuses = Array.isArray(body.statuses) ? body.statuses : [];
  if (statuses.length === 0 || statuses.some((s: any) => s !== 'open' && s !== 'pending')) {
    return { ok: false, error: 'invalid statuses' };
  }
  const t = body.target;
  if (!t || (t.type !== 'assign' && t.type !== 'return_queue')) return { ok: false, error: 'invalid target' };
  if (t.type === 'assign') {
    if (typeof t.assigned_to !== 'string' || !t.assigned_to.trim()) {
      return { ok: false, error: 'invalid target.assigned_to' };
    }
    if (t.assigned_user_id != null && !Number.isFinite(Number(t.assigned_user_id))) {
      return { ok: false, error: 'invalid target.assigned_user_id' };
    }
  }
  return { ok: true, data: body as Body };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function applyFilters(query: any, body: Body) {
  query = query.eq('client_id', body.client_id).in('status', body.statuses);
  if (body.start) query = query.gte('opened_at', body.start);
  if (body.end) query = query.lte('opened_at', body.end);
  if (body.queue_id) query = query.eq('queue_id', body.queue_id);

  const who = (body.current_assignee ?? 'all').trim();
  if (who === 'unassigned') {
    query = query.is('assigned_to', null);
  } else if (who && who !== 'all') {
    query = query.eq('assigned_to', who);
  }

  // Ao devolver para a fila, só faz sentido mexer em conversas com responsável.
  if (body.target.type === 'return_queue' && who === 'all') {
    query = query.not('assigned_to', 'is', null);
  }
  // Ao atribuir, evita reprocessar quem já é o destino.
  if (body.target.type === 'assign' && body.target.assigned_to) {
    query = query.or(`assigned_to.is.null,assigned_to.neq.${body.target.assigned_to.replace(/[(),]/g, ' ')}`);
  }
  return query;
}

/** Capacidade do destino, quando o alvo é atribuir a um atendente. */
// deno-lint-ignore no-explicit-any
async function targetCapacity(supabase: any, body: Body): Promise<CapacityInfo | null> {
  if (body.target.type !== 'assign') return null;
  const ident = agentIdentifier(
    body.target.assigned_user_id ?? null,
    String(body.target.assigned_to ?? ''),
  );
  if (!ident) return null;
  return await checkCapacity(supabase, body.client_id, ident);
}

async function runPreview(supabase: any, body: Body) {
  const all: Array<{ id: string; queue_id: string | null; assigned_to: string | null; opened_at: string }> = [];
  const PAGE = 1000;
  for (let from = 0; from < MAX; from += PAGE) {
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
  }

  const byQueue: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const r of all) {
    const qk = r.queue_id ?? 'sem_fila';
    byQueue[qk] = (byQueue[qk] ?? 0) + 1;
    const ak = r.assigned_to && r.assigned_to.trim() ? r.assigned_to : 'Julia (sem responsável)';
    byAssignee[ak] = (byAssignee[ak] ?? 0) + 1;
    if (!oldest || r.opened_at < oldest) oldest = r.opened_at;
    if (!newest || r.opened_at > newest) newest = r.opened_at;
  }

  const cap = await targetCapacity(supabase, body);
  const slots = cap ? cap.slots : null;
  const willTransfer = slots == null ? all.length : Math.min(all.length, slots);

  return {
    total: all.length,
    capped: all.length >= MAX,
    byQueue,
    byAssignee,
    oldest,
    newest,
    capacity: cap
      ? { load: cap.load, max_concurrent: cap.max_concurrent, slots: cap.slots, blocked: cap.blocked }
      : null,
    will_transfer: willTransfer,
    overflow: slots == null ? 0 : Math.max(0, all.length - slots),
    capacity_message: cap && cap.blocked ? capacityBlockedMessage(cap) : null,
  };
}

async function runCommit(supabase: any, body: Body) {
  const batchId = crypto.randomUUID();
  const actorName = (body.actor_name ?? 'Sistema').toString();
  const actorUserId =
    body.actor_user_id != null && Number.isFinite(Number(body.actor_user_id))
      ? Number(body.actor_user_id)
      : null;
  const isAssign = body.target.type === 'assign';
  const targetName = isAssign ? String(body.target.assigned_to) : null;
  const targetUserId =
    isAssign && body.target.assigned_user_id != null && Number.isFinite(Number(body.target.assigned_user_id))
      ? Number(body.target.assigned_user_id)
      : null;

  let transferred = 0;
  let skipped = 0;

  // Capacidade do destino: nunca transfere acima do teto do atendente.
  const cap = await targetCapacity(supabase, body);
  let remaining = cap ? cap.slots : Number.POSITIVE_INFINITY;
  if (cap && cap.blocked) {
    return {
      batch_id: batchId,
      transferred: 0,
      skipped: 0,
      blocked: true,
      capacity_message: capacityBlockedMessage(cap),
      capacity: { load: cap.load, max_concurrent: cap.max_concurrent, slots: 0 },
    };
  }

  for (let iter = 0; iter < 200; iter++) {
    if (remaining <= 0) break;
    let q = supabase
      .from('chat_conversations')
      .select('id, queue_id, contact_id, assigned_to, assigned_user_id, status')
      .order('opened_at', { ascending: true })
      .limit(Math.min(BATCH_SIZE, Number.isFinite(remaining) ? remaining : BATCH_SIZE));
    q = applyFilters(q, body);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const ids = rows.map((r: any) => r.id);
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = isAssign
      ? {
          assigned_to: targetName,
          assigned_user_id: targetUserId,
          status: 'open',
          assigned_at: now,
          updated_at: now,
        }
      : {
          assigned_to: null,
          assigned_user_id: null,
          status: 'pending',
          updated_at: now,
        };

    const { data: updated, error: upErr } = await supabase
      .from('chat_conversations')
      .update(updates)
      .in('id', ids)
      .in('status', body.statuses)
      .select('id');
    if (upErr) throw upErr;

    const updatedSet = new Set((updated ?? []).map((r: any) => r.id));
    const okRows = rows.filter((r: any) => updatedSet.has(r.id));
    skipped += rows.length - okRows.length;

    if (okRows.length > 0) {
      const historyRows = okRows.map((r: any) => ({
        conversation_id: r.id,
        action: isAssign ? 'bulk_transferred' : 'bulk_returned_to_queue',
        actor_name: actorName,
        user_id: actorUserId,
        from_value: r.assigned_to ?? null,
        from_user_id: r.assigned_user_id ?? null,
        to_value: isAssign ? targetName : 'pending',
        to_user_id: isAssign ? targetUserId : null,
        notes: isAssign
          ? `Transferido em lote para ${targetName} por ${actorName} (batch ${batchId})`
          : `Devolvido à fila em lote por ${actorName} (batch ${batchId})`,
        created_at: now,
      }));
      const { error: hErr } = await supabase.from('chat_conversation_history').insert(historyRows);
      if (hErr) throw hErr;
      transferred += okRows.length;
      if (Number.isFinite(remaining)) remaining -= okRows.length;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return {
    batch_id: batchId,
    transferred,
    skipped,
    blocked: false,
    capacity: cap ? { load: cap.load + transferred, max_concurrent: cap.max_concurrent, slots: Math.max(0, cap.slots - transferred) } : null,
  };
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

  try {
    const result = v.data.action === 'preview'
      ? await runPreview(supabase, v.data)
      : await runCommit(supabase, v.data);
    return json(result, 200);
  } catch (err: any) {
    console.error('chat-bulk-transfer error:', err);
    return json({ error: String(err?.message || err) }, 500);
  }
});
