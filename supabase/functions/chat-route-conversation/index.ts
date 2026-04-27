// Roteia uma conversa nova segundo regras configuradas (round-robin / least-busy / specific / pool).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
  status: s,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

interface Cond { field: string; op: string; value: string }
interface Rule {
  id: string;
  client_id: string;
  is_active: boolean;
  position: number;
  conditions: Cond[];
  strategy: string;
  agent_pool: string[];
  fallback_assigned_to: string | null;
  only_business_hours: boolean;
  last_assigned_to: string | null;
  target_queue_id?: string | null;
}

/**
 * Filtra agent_pool removendo agentes (cod_agent) cujos user_ids não têm
 * acesso à fila alvo da rule. Aplicado quando rule.target_queue_id existe.
 * Se db-query falhar ou retornar vazio, mantém o pool original (fail-open).
 */
async function filterPoolByQueueAccess(rule: Rule): Promise<string[]> {
  const pool = rule.agent_pool || [];
  if (!rule.target_queue_id || pool.length === 0) return pool;
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/db-query`;
    const allowedRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'list_users_for_queue',
        data: { client_id: rule.client_id, queue_id: rule.target_queue_id },
      }),
    });
    const allowedJson = await allowedRes.json();
    const allowedUserIds: number[] = (allowedJson?.data || []).map((r: any) => Number(r.id));
    if (allowedUserIds.length === 0) return pool;

    // Mapeia cod_agent → user_id via user_agents (external DB)
    const mapRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'raw',
        data: {
          query: `SELECT cod_agent::text as cod_agent, user_id FROM user_agents WHERE cod_agent::text = ANY($1)`,
          params: [pool],
        },
      }),
    });
    const mapJson = await mapRes.json();
    const codToUser = new Map<string, number>();
    for (const row of (mapJson?.data || [])) {
      codToUser.set(String(row.cod_agent), Number(row.user_id));
    }

    const allowedSet = new Set(allowedUserIds);
    const filtered = pool.filter((cod) => {
      const uid = codToUser.get(String(cod));
      // Se não conseguimos mapear, deixa passar (fail-open)
      if (!uid) return true;
      return allowedSet.has(uid);
    });
    return filtered.length > 0 ? filtered : pool;
  } catch (err) {
    console.warn('[chat-route] queue-access filter failed, using original pool:', err);
    return pool;
  }
}

interface Conv {
  id: string;
  client_id: string;
  channel: string;
  priority: string;
  tags: string[] | null;
  assigned_to: string | null;
}

function inBusinessHours(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours() - 3; // BRT
  const h = (utcHours + 24) % 24;
  const day = now.getUTCDay();
  return day >= 1 && day <= 5 && h >= 8 && h < 18;
}

function matchCondition(c: Cond, conv: Conv, lastMsg: string): boolean {
  const get = (): string => {
    if (c.field === 'channel') return conv.channel || '';
    if (c.field === 'priority') return conv.priority || '';
    if (c.field === 'tag') return (conv.tags || []).join(',');
    if (c.field === 'keyword') return lastMsg;
    if (c.field === 'business_hours') return inBusinessHours() ? 'true' : 'false';
    return '';
  };
  const v = get().toLowerCase();
  const target = (c.value || '').toLowerCase();
  if (c.op === 'equals') return v === target;
  if (c.op === 'contains') return v.includes(target);
  if (c.op === 'in') return target.split(',').map(s => s.trim()).includes(v);
  if (c.op === 'not_in') return !target.split(',').map(s => s.trim()).includes(v);
  return false;
}

async function pickAgent(rule: Rule): Promise<string | null> {
  // Aplica filtro de acesso por fila ANTES de escolher
  const pool = await filterPoolByQueueAccess(rule);
  if (pool.length === 0) return rule.fallback_assigned_to;

  if (rule.strategy === 'specific_agent') return pool[0];
  if (rule.strategy === 'manual_pool') return rule.fallback_assigned_to;

  const { data: caps } = await supabase
    .from('chat_agent_capacity')
    .select('*')
    .eq('client_id', rule.client_id)
    .in('agent_identifier', pool)
    .eq('is_active', true)
    .eq('status', 'online');
  const available = (caps || []).filter((c) => c.current_load < c.max_concurrent);
  if (available.length === 0) return rule.fallback_assigned_to;

  if (rule.strategy === 'least_busy') {
    available.sort((a, b) => (a.current_load / a.max_concurrent) - (b.current_load / b.max_concurrent));
    return available[0].agent_identifier;
  }
  // round_robin: pegue o próximo após last_assigned_to
  const ids = available.map((a) => a.agent_identifier);
  if (!rule.last_assigned_to) return ids[0];
  const idx = ids.indexOf(rule.last_assigned_to);
  return ids[(idx + 1) % ids.length];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) return json({ error: "conversation_id required" }, 400);

    const { data: conv } = await supabase.from('chat_conversations').select('*').eq('id', conversation_id).maybeSingle();
    if (!conv) return json({ error: "conversation not found" }, 404);
    if (conv.assigned_to) return json({ skipped: true, reason: "already_assigned", assigned_to: conv.assigned_to });

    const { data: lastMsgRow } = await supabase
      .from('chat_messages').select('text').eq('conversation_id', conversation_id).eq('from_me', false)
      .order('timestamp', { ascending: false }).limit(1).maybeSingle();
    const lastMsg = (lastMsgRow?.text || '').toLowerCase();

    const { data: rules } = await supabase
      .from('chat_routing_rules').select('*').eq('client_id', conv.client_id).eq('is_active', true)
      .order('position', { ascending: true });

    for (const rule of (rules || []) as Rule[]) {
      if (rule.only_business_hours && !inBusinessHours()) continue;
      const allMatch = (rule.conditions || []).every((c) => matchCondition(c, conv as Conv, lastMsg));
      if (!allMatch) continue;

      const agent = await pickAgent(rule);
      if (!agent) continue;

      await supabase.from('chat_conversations').update({
        assigned_to: agent,
        status: conv.status === 'pending' ? 'open' : conv.status,
      }).eq('id', conversation_id);

      await supabase.from('chat_routing_rules').update({
        execution_count: (rule as unknown as { execution_count: number }).execution_count + 1 || 1,
        last_executed_at: new Date().toISOString(),
        last_assigned_to: agent,
      }).eq('id', rule.id);

      await supabase.rpc('inc_agent_load' as never, {} as never).then(() => {}, () => {});
      // increment load directly
      await supabase.from('chat_agent_capacity').update({
        last_assigned_at: new Date().toISOString(),
      }).eq('client_id', conv.client_id).eq('agent_identifier', agent);

      await supabase.from('chat_conversation_history').insert({
        conversation_id,
        action: 'auto_routed',
        actor_name: 'Sistema',
        to_value: agent,
        notes: `Regra: ${(rule as unknown as { name: string }).name}`,
      });

      return json({ assigned_to: agent, rule_id: rule.id });
    }

    return json({ skipped: true, reason: "no_matching_rule" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
