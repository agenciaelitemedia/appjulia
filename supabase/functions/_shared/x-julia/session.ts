// ============================================
// X-Julia — sessões, CTA e trilha de eventos
// ============================================
import type { XJAgent, XJInboundMessage, XJQueueCreds, XJSession, XJStage } from "./types.ts";

// deno-lint-ignore no-explicit-any
export async function logXJEvent(supabase: any, session: XJSession, event: Record<string, unknown>) {
  try {
    await supabase.from("xj_session_events").insert({
      client_id: session.client_id,
      session_id: session.id,
      stage: session.stage,
      ...event,
    });
  } catch (err) {
    console.warn("[x-julia/session] falha ao registrar evento:", String(err));
  }
}

/** Encontra o agente X-Julia ativo vinculado à fila da conversa. */
// deno-lint-ignore no-explicit-any
export async function findAgentForQueue(supabase: any, clientId: string, queueId: string | null) {
  if (!queueId) return null;
  const { data } = await supabase
    .from("xj_agent_queue_links")
    .select("agent_id, xj_agents!inner(*)")
    .eq("queue_id", queueId)
    .eq("client_id", String(clientId))
    .limit(10);
  const rows = (data ?? []) as any[];
  const agents = rows.map((r) => r.xj_agents).filter(Boolean) as any[];
  // Prioriza o recepcionista (roteador); mantém compatibilidade com setups antigos.
  const agent = (agents.find((a) => a.is_active && (a.role ?? "reception") === "reception") ??
    agents.find((a) => a.is_active) ??
    agents[0]) as XJAgent | undefined;
  if (!agent || !agent.is_active) return null;
  return normalizeAgent(agent);
}

/** Normaliza os campos jsonb do agente. */
// deno-lint-ignore no-explicit-any
export function normalizeAgent(agent: any): XJAgent {
  return {
    ...agent,
    role: agent.role ?? "reception",
    stage_prompts: (agent.stage_prompts ?? {}) as Record<string, string>,
    voice_settings: (agent.voice_settings ?? {}) as Record<string, unknown>,
    business_hours: (agent.business_hours ?? {}) as Record<string, unknown>,
    handoff_policy: (agent.handoff_policy ?? {}) as Record<string, unknown>,
  } as XJAgent;
}

/** Agente especialista ativo responsável por um caso jurídico. */
// deno-lint-ignore no-explicit-any
export async function findSpecialistForCase(
  supabase: any,
  clientId: string,
  caseId: string | null,
): Promise<XJAgent | null> {
  if (!caseId) return null;
  const { data } = await supabase
    .from("xj_agents")
    .select("*")
    .eq("client_id", String(clientId))
    .eq("role", "specialist")
    .eq("case_id", caseId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data ? normalizeAgent(data) : null;
}

/** Casa a mensagem/campanha de entrada com um gatilho de CTA configurado. */
// deno-lint-ignore no-explicit-any
export async function matchCtaTrigger(
  supabase: any,
  clientId: string,
  agentId: string,
  inbound: XJInboundMessage,
) {
  const { data } = await supabase
    .from("xj_cta_triggers")
    .select("*")
    .eq("client_id", String(clientId))
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const haystack = [inbound.text, inbound.cta_payload, inbound.campaign_title, inbound.campaign_id]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
  if (!haystack.trim()) return null;

  for (const trigger of (data ?? [])) {
    if (trigger.agent_id && trigger.agent_id !== agentId) continue;
    const value = String(trigger.match_value ?? "").toLowerCase().trim();
    if (!value) continue;
    const matched =
      trigger.match_type === "exact"
        ? haystack === value
        : trigger.match_type === "campaign_id"
          ? String(inbound.campaign_id ?? "").toLowerCase() === value
          : trigger.match_type === "regex"
            ? safeRegex(value)?.test(haystack) ?? false
            : haystack.includes(value);
    if (matched) return trigger;
  }
  return null;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/**
 * Sessão por conversa. A entrada é universal: qualquer mensagem recebida em
 * uma fila vinculada abre a sessão em "recepcao"; o CTA apenas enriquece.
 */
// deno-lint-ignore no-explicit-any
export async function getOrCreateSession(
  supabase: any,
  params: {
    clientId: string;
    agent: XJAgent;
    conversationId: string | null;
    contactId: string | null;
    queue: XJQueueCreds | null;
    phone: string | null;
    contactName: string | null;
    channel: string | null;
    inbound: XJInboundMessage;
  },
): Promise<{ session: XJSession; created: boolean; cta: any | null }> {
  const { clientId, agent, conversationId, contactId, queue, inbound } = params;

  if (conversationId) {
    const { data: existing } = await supabase
      .from("xj_sessions")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (existing) {
      return { session: normalize(existing), created: false, cta: null };
    }
  }

  const cta = await matchCtaTrigger(supabase, clientId, agent.id, inbound);

  const payload = {
    client_id: String(clientId),
    agent_id: agent.id,
    conversation_id: conversationId,
    contact_id: contactId,
    queue_id: queue?.id ?? null,
    phone: params.phone,
    contact_name: params.contactName,
    channel: params.channel,
    origin: cta?.platform ?? (inbound.campaign_id ? "ads" : "organico"),
    campaign_id: inbound.campaign_id ?? cta?.campaign_id ?? null,
    cta_trigger_id: cta?.id ?? null,
    case_id: cta?.case_id ?? null,
    stage: "recepcao" as XJStage,
    slots: {},
  };

  const { data, error } = await supabase.from("xj_sessions").insert(payload).select("*").single();
  if (error) {
    // Corrida: outra invocação criou a sessão da mesma conversa.
    const { data: retry } = await supabase
      .from("xj_sessions")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (retry) return { session: normalize(retry), created: false, cta };
    throw error;
  }
  return { session: normalize(data), created: true, cta };
}

function normalize(row: any): XJSession {
  return { ...row, slots: (row.slots ?? {}) as Record<string, unknown> } as XJSession;
}

// deno-lint-ignore no-explicit-any
export async function updateSession(supabase: any, session: XJSession, patch: Record<string, unknown>) {
  Object.assign(session, patch);
  await supabase.from("xj_sessions").update(patch).eq("id", session.id);
}