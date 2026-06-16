// Roteia uma conversa nova segundo regras de chat_routing_rules.
// Identifica atendentes por user_id (scoped por client_id) — não usa cod_agent.
// Estratégias: round_robin | least_busy | specific_agent | manual_pool | random
// Filtros: agent_pool ∖ excluded_agents → queue access → online_only → capacidade.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchClientAutomationFlags } from "../_shared/agentSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Cond { field: string; op: string; value: string }
interface Rule {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  position: number;
  conditions: Cond[];
  strategy: string;
  agent_pool: string[];
  excluded_agents: string[] | null;
  online_only: boolean | null;
  fallback_assigned_to: string | null;
  only_business_hours: boolean;
  last_assigned_to: string | null;
  target_queue_id?: string | null;
  execution_count: number;
}

interface Conv {
  id: string;
  client_id: string;
  channel: string;
  priority: string;
  tags: string[] | null;
  queue_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
}

function inBusinessHours(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours() - 3; // BRT
  const h = (utcHours + 24) % 24;
  const day = now.getUTCDay();
  return day >= 1 && day <= 5 && h >= 8 && h < 18;
}

async function callDbQuery(action: string, data: unknown): Promise<any> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/db-query`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ action, data }),
  });
  return await resp.json();
}

/**
 * Filtra o pool deixando apenas user_ids com acesso à fila alvo. Aplicado
 * quando rule.target_queue_id está definido. Fail-open em caso de erro.
 */
async function filterPoolByQueueAccess(rule: Rule, pool: string[]): Promise<string[]> {
  if (!rule.target_queue_id || pool.length === 0) return pool;
  try {
    const out = await callDbQuery('list_users_for_queue', {
      client_id: rule.client_id,
      queue_id: rule.target_queue_id,
    });
    const allowed = new Set<string>((out?.data || []).map((r: any) => String(r.id)));
    if (allowed.size === 0) return pool;
    const filtered = pool.filter((uid) => allowed.has(String(uid)));
    return filtered.length > 0 ? filtered : pool;
  } catch (err) {
    console.warn('[chat-route] queue-access filter failed:', err);
    return pool;
  }
}

/**
 * Mantém apenas user_ids do pool cuja presença foi atualizada nos
 * últimos 5 minutos para o mesmo client_id.
 */
async function filterByOnlinePresence(pool: string[], clientId: string): Promise<string[]> {
  if (pool.length === 0) return pool;
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, last_seen_at, client_id')
      .in('user_id', pool.map((p) => Number(p)).filter((n) => Number.isFinite(n)))
      .eq('client_id', Number(clientId));
    if (error) throw error;
    const cutoff = Date.now() - 5 * 60_000;
    const online = new Set<string>();
    for (const row of (data || [])) {
      const t = new Date(row.last_seen_at as string).getTime();
      if (Number.isFinite(t) && t >= cutoff) online.add(String(row.user_id));
    }
    return pool.filter((uid) => online.has(String(uid)));
  } catch (err) {
    console.warn('[chat-route] online filter failed:', err);
    return pool;
  }
}

async function contactIsNew(conv: Conv): Promise<boolean> {
  if (!conv.contact_id) return true;
  try {
    const { count } = await supabase
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', conv.contact_id)
      .eq('client_id', conv.client_id);
    return (count ?? 0) <= 1;
  } catch {
    return false;
  }
}

function matchCondition(c: Cond, conv: Conv, lastMsg: string, isNew: boolean): boolean {
  const get = (): string => {
    if (c.field === 'channel') return conv.channel || '';
    if (c.field === 'priority') return conv.priority || '';
    if (c.field === 'tag') return (conv.tags || []).join(',');
    if (c.field === 'keyword') return lastMsg;
    if (c.field === 'business_hours') return inBusinessHours() ? 'true' : 'false';
    if (c.field === 'queue') return conv.queue_id || '';
    if (c.field === 'contact_is_new') return isNew ? 'true' : 'false';
    return '';
  };
  const v = get().toLowerCase();
  const target = (c.value || '').toLowerCase();
  if (c.op === 'equals') return v === target;
  if (c.op === 'contains') return v.includes(target);
  if (c.op === 'in') return target.split(',').map((s) => s.trim()).includes(v);
  if (c.op === 'not_in') return !target.split(',').map((s) => s.trim()).includes(v);
  return false;
}

async function pickAgent(rule: Rule): Promise<string | null> {
  let pool = (rule.agent_pool || []).map(String);
  const excluded = new Set((rule.excluded_agents || []).map(String));
  pool = pool.filter((id) => !excluded.has(id));
  pool = await filterPoolByQueueAccess(rule, pool);
  if (rule.online_only) pool = await filterByOnlinePresence(pool, rule.client_id);
  if (pool.length === 0) return rule.fallback_assigned_to;

  if (rule.strategy === 'specific_agent') return pool[0];
  if (rule.strategy === 'manual_pool') return rule.fallback_assigned_to;
  if (rule.strategy === 'random') return pool[Math.floor(Math.random() * pool.length)];

  const { data: caps } = await supabase
    .from('chat_agent_capacity')
    .select('*')
    .eq('client_id', rule.client_id)
    .in('agent_identifier', pool)
    .eq('is_active', true)
    .eq('status', 'online');

  // Atendentes sem registro em chat_agent_capacity passam (fail-open p/ teto default 5).
  const capMap = new Map<string, { current_load: number; max_concurrent: number }>();
  for (const c of (caps || [])) {
    capMap.set(String(c.agent_identifier), {
      current_load: Number((c as any).current_load) || 0,
      max_concurrent: Number((c as any).max_concurrent) || 5,
    });
  }
  const available = pool
    .map((id) => ({ id, ...(capMap.get(id) ?? { current_load: 0, max_concurrent: 5 }) }))
    .filter((a) => a.current_load < a.max_concurrent);
  if (available.length === 0) return rule.fallback_assigned_to;

  if (rule.strategy === 'least_busy') {
    available.sort((a, b) => (a.current_load / a.max_concurrent) - (b.current_load / b.max_concurrent));
    return available[0].id;
  }
  // round_robin
  const ids = available.map((a) => a.id);
  if (!rule.last_assigned_to) return ids[0];
  const idx = ids.indexOf(String(rule.last_assigned_to));
  return ids[(idx + 1) % ids.length];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) return json({ error: "conversation_id required" }, 400);

    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('id, client_id, channel, priority, tags, queue_id, contact_id, assigned_to, status')
      .eq('id', conversation_id)
      .maybeSingle();
    if (!conv) return json({ error: "conversation not found" }, 404);
    if (conv.assigned_to) {
      return json({ skipped: true, reason: "already_assigned", assigned_to: conv.assigned_to });
    }

    // Master flag check (defesa em profundidade).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    try {
      const url = `${supabaseUrl}/rest/v1/chat_client_settings?client_id=eq.${encodeURIComponent(String(conv.client_id))}&select=settings&limit=1`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      const rows = resp.ok ? await resp.json() : [];
      const s = (Array.isArray(rows) ? rows[0]?.settings : null) as Record<string, unknown> | null;
      const enabled = s?.auto_distribution_enabled === true || s?.auto_distribution_enabled === 'true';
      if (!enabled) return json({ skipped: true, reason: "auto_distribution_disabled" });
    } catch (e) {
      console.warn('[chat-route] master flag check failed, aborting:', (e as Error).message);
      return json({ skipped: true, reason: "flag_check_error" });
    }

    const { data: lastMsgRow } = await supabase
      .from('chat_messages')
      .select('text')
      .eq('conversation_id', conversation_id)
      .eq('from_me', false)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastMsg = (lastMsgRow?.text || '').toLowerCase();

    const isNew = await contactIsNew(conv as Conv);

    const { data: rules } = await supabase
      .from('chat_routing_rules')
      .select('*')
      .eq('client_id', conv.client_id)
      .eq('is_active', true)
      .order('position', { ascending: true });

    for (const rule of (rules || []) as Rule[]) {
      if (rule.only_business_hours && !inBusinessHours()) continue;
      const allMatch = (rule.conditions || []).every((c) =>
        matchCondition(c, conv as Conv, lastMsg, isNew),
      );
      if (!allMatch) continue;

      const agent = await pickAgent(rule);
      if (!agent) continue;

      await supabase
        .from('chat_conversations')
        .update({
          assigned_to: agent,
          status: conv.status === 'pending' ? 'open' : conv.status,
        })
        .eq('id', conversation_id);

      await supabase
        .from('chat_routing_rules')
        .update({
          execution_count: (rule.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
          last_assigned_to: agent,
        })
        .eq('id', rule.id);

      await supabase
        .from('chat_agent_capacity')
        .update({ last_assigned_at: new Date().toISOString() })
        .eq('client_id', conv.client_id)
        .eq('agent_identifier', agent);

      await supabase.from('chat_conversation_history').insert({
        conversation_id,
        action: 'auto_routed',
        actor_name: 'Sistema',
        to_value: agent,
        notes: `Regra: ${rule.name}`,
      });

      // Helps the unused-import linter pacify when fetchClientAutomationFlags
      // is reserved for future cross-checks.
      void fetchClientAutomationFlags;

      return json({ assigned_to: agent, rule_id: rule.id });
    }

    return json({ skipped: true, reason: "no_matching_rule" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});