// ============================================
// chat-rebalance-overflow
//
// Devolve à fila o EXCEDENTE de atendimentos dos atendentes que estão acima do
// teto (chat_agent_capacity.max_concurrent, padrão 20). A carga considerada é a
// real (chat_agent_live_load). São devolvidas as conversas mais antigas sem
// resposta recente — ordenadas por último contato do cliente (ou abertura).
//
// Body: { action: 'preview' | 'commit', client_id, actor_name?, actor_user_id?,
//         agent_identifier? (limita a um atendente), min_idle_hours? }
// ============================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { isAutoDistributionEnabled, loadCapacityCaps, loadLiveLoads } from '../_shared/chat/capacity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVE_STATUSES = ['open', 'pending'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Body {
  action: 'preview' | 'commit';
  client_id: string;
  actor_name?: string;
  actor_user_id?: number | null;
  agent_identifier?: string | null;
  /** Só devolve conversas sem contato do cliente nas últimas N horas. 0 = sem filtro. */
  min_idle_hours?: number;
}

function validate(raw: any): { ok: true; data: Body } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'body inválido' };
  const action = raw.action === 'commit' ? 'commit' : raw.action === 'preview' ? 'preview' : null;
  if (!action) return { ok: false, error: 'action deve ser preview ou commit' };
  const clientId = raw.client_id != null ? String(raw.client_id).trim() : '';
  if (!clientId) return { ok: false, error: 'client_id é obrigatório' };
  const idle = Number(raw.min_idle_hours);
  return {
    ok: true,
    data: {
      action,
      client_id: clientId,
      actor_name: raw.actor_name ? String(raw.actor_name) : 'Sistema',
      actor_user_id: Number.isFinite(Number(raw.actor_user_id)) ? Number(raw.actor_user_id) : null,
      agent_identifier: raw.agent_identifier ? String(raw.agent_identifier) : null,
      min_idle_hours: Number.isFinite(idle) && idle > 0 ? idle : 0,
    },
  };
}

interface Overflow {
  agent_identifier: string;
  agent_name: string | null;
  load: number;
  max_concurrent: number;
  overflow: number;
}

// deno-lint-ignore no-explicit-any
async function computeOverflows(supabase: any, body: Body): Promise<Overflow[]> {
  const [loads, caps, autoOn] = await Promise.all([
    loadLiveLoads(supabase, body.client_id),
    loadCapacityCaps(supabase, body.client_id),
    isAutoDistributionEnabled(supabase, body.client_id),
  ]);
  // Sem distribuição automática ativada não há limites: nada a rebalancear.
  if (!autoOn) return [];

  const out: Overflow[] = [];
  for (const [id, load] of loads.entries()) {
    if (body.agent_identifier && id !== body.agent_identifier) continue;
    const cap = caps.get(id);
    // Só atendentes com limite configurado e ativo entram no rebalanceamento.
    if (!cap || !cap.active || !cap.max || cap.max <= 0) continue;
    const max = cap.max;
    if (load > max) {
      out.push({
        agent_identifier: id,
        agent_name: cap?.name ?? null,
        load,
        max_concurrent: max,
        overflow: load - max,
      });
    }
  }
  out.sort((a, b) => b.overflow - a.overflow);
  return out;
}

/** Conversas candidatas do atendente, das mais paradas para as mais recentes. */
// deno-lint-ignore no-explicit-any
async function pickCandidates(supabase: any, body: Body, agentId: string, limit: number) {
  let q = supabase
    .from('chat_conversations')
    .select('id, assigned_to, assigned_user_id, queue_id, last_customer_message_at, opened_at, status')
    .eq('client_id', body.client_id)
    .in('status', ACTIVE_STATUSES)
    .or(`assigned_user_id.eq.${agentId},assigned_to.eq.${agentId}`)
    .order('last_customer_message_at', { ascending: true, nullsFirst: true })
    .order('opened_at', { ascending: true })
    .limit(limit);

  if (body.min_idle_hours && body.min_idle_hours > 0) {
    const cutoff = new Date(Date.now() - body.min_idle_hours * 3_600_000).toISOString();
    q = q.or(`last_customer_message_at.is.null,last_customer_message_at.lt.${cutoff}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; assigned_to: string | null; assigned_user_id: number | null }>;
}

// deno-lint-ignore no-explicit-any
async function run(supabase: any, body: Body) {
  const overflows = await computeOverflows(supabase, body);
  const batchId = crypto.randomUUID();
  const details: Array<Overflow & { candidates: number; returned: number }> = [];
  let totalReturned = 0;

  for (const ov of overflows) {
    const candidates = await pickCandidates(supabase, body, ov.agent_identifier, ov.overflow);
    let returned = 0;

    if (body.action === 'commit' && candidates.length > 0) {
      const now = new Date().toISOString();
      const ids = candidates.map((c) => c.id);
      const { data: updated, error } = await supabase
        .from('chat_conversations')
        .update({
          assigned_to: null,
          assigned_user_id: null,
          status: 'pending',
          assigned_at: null,
          updated_at: now,
        })
        .in('id', ids)
        .in('status', ACTIVE_STATUSES)
        .select('id');
      if (error) throw error;

      const okIds = (updated ?? []).map((r: any) => r.id);
      returned = okIds.length;
      totalReturned += returned;

      if (okIds.length > 0) {
        const history = candidates
          .filter((c) => okIds.includes(c.id))
          .map((c) => ({
            conversation_id: c.id,
            action: 'rebalanced_to_queue',
            actor_name: body.actor_name ?? 'Sistema',
            user_id: body.actor_user_id,
            from_value: c.assigned_to ?? null,
            from_user_id: c.assigned_user_id ?? null,
            to_value: 'pending',
            notes:
              `Devolvido à fila por excedente de capacidade ` +
              `(${ov.load}/${ov.max_concurrent}) — batch ${batchId}`,
            created_at: now,
          }));
        const { error: hErr } = await supabase.from('chat_conversation_history').insert(history);
        if (hErr) throw hErr;
      }
    }

    details.push({ ...ov, candidates: candidates.length, returned });
  }

  return {
    batch_id: batchId,
    action: body.action,
    agents: details,
    total_overflow: details.reduce((s, d) => s + d.overflow, 0),
    total_candidates: details.reduce((s, d) => s + d.candidates, 0),
    total_returned: totalReturned,
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
    return json(await run(supabase, v.data), 200);
  } catch (err: any) {
    console.error('chat-rebalance-overflow error:', err);
    return json({ error: String(err?.message || err) }, 500);
  }
});
