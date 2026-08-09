// ============================================
// X-Julia — followup configurável (cadência + passos multimídia)
// Conteúdo fixo ou gerado por IA com base no histórico da conversa.
// ============================================
import { xjComplete } from "./llm.ts";
import { loadHistory } from "./prompt.ts";
import type { XJAgent, XJSession } from "./types.ts";

/** Cadência aplicável: específica do caso+estágio > caso > estágio > geral. */
// deno-lint-ignore no-explicit-any
export async function resolveCadence(supabase: any, session: XJSession) {
  const { data } = await supabase
    .from("xj_followup_cadences")
    .select("*, xj_followup_steps(*)")
    .eq("client_id", String(session.client_id))
    .eq("agent_id", session.agent_id)
    .eq("is_active", true);

  const list = (data ?? []).filter((c: any) => (c.xj_followup_steps ?? []).some((s: any) => s.is_active));
  if (!list.length) return null;

  const score = (c: any) =>
    (c.case_id && c.case_id === session.case_id ? 2 : 0) + (c.stage && c.stage === session.stage ? 1 : 0) -
    (c.case_id && c.case_id !== session.case_id ? 10 : 0) -
    (c.stage && c.stage !== session.stage ? 10 : 0);

  const best = list.map((c: any) => ({ c, s: score(c) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)[0];
  if (!best) return null;
  const cadence = best.c;
  cadence.steps = (cadence.xj_followup_steps ?? [])
    .filter((s: any) => s.is_active)
    .sort((a: any, b: any) => a.position - b.position);
  return cadence;
}

/** Cancela followups pendentes (usado quando o lead responde). */
// deno-lint-ignore no-explicit-any
export async function cancelPendingFollowups(supabase: any, sessionId: string) {
  await supabase
    .from("xj_followups")
    .update({ status: "cancelled" })
    .eq("session_id", sessionId)
    .eq("status", "pending");
}

/** Agenda o próximo passo da cadência para a sessão. */
// deno-lint-ignore no-explicit-any
export async function scheduleNextFollowup(supabase: any, session: XJSession, attempt = 1) {
  if (["humano", "encerrado"].includes(session.stage)) return null;
  const cadence = await resolveCadence(supabase, session);
  if (!cadence) return null;

  const step = cadence.steps[attempt - 1];
  if (!step) {
    if (cadence.on_exhausted_action === "handoff") {
      await supabase.from("xj_sessions").update({ stage: "humano" }).eq("id", session.id);
    } else if (cadence.on_exhausted_action === "close") {
      await supabase.from("xj_sessions").update({ stage: "encerrado", is_active: false }).eq("id", session.id);
    }
    return null;
  }

  const runAt = new Date(Date.now() + Number(step.delay_minutes ?? 120) * 60_000).toISOString();
  const { data } = await supabase
    .from("xj_followups")
    .insert({
      client_id: session.client_id,
      session_id: session.id,
      cadence_id: cadence.id,
      step_id: step.id,
      attempt,
      run_at: runAt,
      status: "pending",
    })
    .select("id, run_at")
    .single();
  return data;
}

/** Resolve o conteúdo de um passo: fixo ou gerado por IA. */
// deno-lint-ignore no-explicit-any
export async function resolveStepContent(
  supabase: any,
  agent: XJAgent,
  session: XJSession,
  step: any,
): Promise<{ type: string; text: string; mediaUrl: string | null }> {
  const type = String(step.content_type ?? "text");
  const mediaUrl = step.media_url ?? null;

  if (type === "link") {
    const label = (step.text_content ?? "").trim();
    return { type: "text", text: [label, step.link_url].filter(Boolean).join("\n"), mediaUrl: null };
  }

  if (step.content_mode !== "ai") {
    return { type, text: (step.text_content ?? "").trim(), mediaUrl };
  }

  const { messages: historyMessages } = await loadHistory(supabase, session.conversation_id, session.contact_id, 30);
  const instruction = (step.generation_prompt ?? "").trim() ||
    "Escreva um follow-up curto, gentil e específico para retomar a conversa deste lead.";

  try {
    const result = await xjComplete({
      supabase,
      provider: agent.llm_provider,
      model: agent.llm_model,
      fallbackEnabled: agent.llm_fallback_enabled,
      clientId: agent.client_id,
      keyMode: (agent as any).llm_key_mode ?? "default",
      messages: [
        {
          role: "system",
          content: `Você é a assistente jurídica ${agent.name}. Gere UMA mensagem de follow-up para WhatsApp em português do Brasil.
Máximo 2 frases, sem saudação repetida, sem emoji excessivo, sem prometer resultado.
Estágio atual do atendimento: ${session.stage}. Dados coletados: ${JSON.stringify(session.slots ?? {})}.
Instrução do escritório: ${instruction}`,
        },
        ...historyMessages,
        { role: "user", content: "Gere agora a mensagem de follow-up." },
      ],
    });
    const text = result.text.trim();
    if (text) return { type: type === "text" ? "text" : type, text, mediaUrl };
  } catch (err) {
    console.warn("[x-julia/followups] geração por IA falhou:", String(err));
  }

  return { type, text: (step.text_content ?? "Podemos continuar seu atendimento?").trim(), mediaUrl };
}