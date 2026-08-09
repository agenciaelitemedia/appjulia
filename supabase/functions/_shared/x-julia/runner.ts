// ============================================
// X-Julia — runner: recebe mensagem, decide, executa skills e responde
// ============================================
import { xjReadInbound } from "./documents.ts";
import { xjComplete } from "./llm.ts";
import { xjSend, xjSendComposed } from "./messaging.ts";
import { buildXJMessages, loadHistory } from "./prompt.ts";
import { cancelPendingFollowups, scheduleNextFollowup } from "./followups.ts";
import { runXJSkill, XJ_TOOLS } from "./skills.ts";
import { logXJEvent, updateSession } from "./session.ts";
import { xjSynthesize } from "./tts.ts";
import type { XJChatMessage, XJRunContext } from "./types.ts";

const MAX_TOOL_ROUNDS = 6;

export async function runXJTurn(ctx: XJRunContext): Promise<{ reply: string | null; stage: string }> {
  const { supabase, agent, session, inbound } = ctx;
  const started = Date.now();

  // 1) Lead respondeu: cancela followups pendentes.
  await cancelPendingFollowups(supabase, session.id);
  await updateSession(supabase, session, {
    last_customer_message_at: new Date().toISOString(),
    turns: (session.turns ?? 0) + 1,
  });

  if (session.turns > agent.max_turns) {
    await runXJSkill(ctx, "encaminhar_humano", { motivo: "limite de turnos do agente atingido" });
    return { reply: null, stage: session.stage };
  }

  // 2) Entrada pode ser áudio/imagem/documento — o agente nunca para.
  const userInput = await xjReadInbound(supabase, agent, inbound);
  if (!userInput.trim()) return { reply: null, stage: session.stage };

  // 3) Contexto do caso (roteiro, base de conhecimento) e catálogo.
  const [questions, knowledge, caseCatalog, history, cta] = await Promise.all([
    session.case_id
      ? supabase
          .from("xj_case_questions")
          .select("position, question, slot_key, is_required")
          .eq("case_id", session.case_id)
          .order("position")
          .then((r: any) => r.data ?? [])
      : Promise.resolve([]),
    session.case_id
      ? supabase
          .from("xj_case_knowledge")
          .select("title, content")
          .eq("case_id", session.case_id)
          .eq("is_active", true)
          .then((r: any) => r.data ?? [])
      : Promise.resolve([]),
    supabase
      .from("xj_legal_cases")
      .select("id, name, category, summary")
      .eq("client_id", String(session.client_id))
      .eq("is_active", true)
      .order("position")
      .then((r: any) => r.data ?? []),
    loadHistory(
      supabase,
      session.conversation_id,
      session.contact_id,
      150,
      ((session.slots ?? {}) as Record<string, any>).__restarted_at ?? null,
    ),
    session.cta_trigger_id
      ? supabase.from("xj_cta_triggers").select("extra_prompt").eq("id", session.cta_trigger_id).maybeSingle()
          .then((r: any) => r.data)
      : Promise.resolve(null),
  ]);

  if (session.case_id && !ctx.legalCase) {
    const { data } = await supabase.from("xj_legal_cases").select("*").eq("id", session.case_id).maybeSingle();
    ctx.legalCase = data ?? null;
  }

  const messages: XJChatMessage[] = buildXJMessages({
    agent,
    session,
    legalCase: ctx.legalCase,
    questions,
    knowledge,
    caseCatalog,
    ctaExtraPrompt: cta?.extra_prompt ?? null,
    history: history.messages,
    historySummary: history.summary,
    currentInput: userInput,
  });

  // 4) Laço de decisão com skills.
  let finalText = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await xjComplete({
      supabase,
      provider: agent.llm_provider,
      model: agent.llm_model,
      fallbackEnabled: agent.llm_fallback_enabled,
      clientId: agent.client_id,
      keyMode: (agent as any).llm_key_mode ?? "default",
      messages,
      tools: XJ_TOOLS,
      temperature: 0.5,
    });

    await logXJEvent(supabase, session, {
      kind: "llm_call",
      provider: completion.provider,
      model: completion.model,
      prompt_tokens: completion.promptTokens,
      completion_tokens: completion.completionTokens,
      duration_ms: completion.durationMs,
      detail: completion.toolCalls.length ? `skills: ${completion.toolCalls.map((t) => t.name).join(", ")}` : "resposta direta",
    });

    if (!completion.toolCalls.length) {
      finalText = completion.text.trim();
      break;
    }

    messages.push({
      role: "assistant",
      content: completion.text || null,
      tool_calls: completion.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
      })),
    });

    for (const call of completion.toolCalls) {
      let result = "";
      let status = "ok";
      try {
        result = await runXJSkill(ctx, call.name, call.args);
      } catch (err) {
        status = "error";
        result = `Erro na skill: ${err instanceof Error ? err.message : String(err)}`;
      }
      await logXJEvent(supabase, session, {
        kind: "skill",
        skill: call.name,
        status,
        detail: result.slice(0, 500),
        payload: call.args ?? {},
      });
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result });
    }

    if (completion.text.trim()) finalText = completion.text.trim();
  }

  if (!finalText) {
    finalText = "Recebi sua mensagem. Pode me contar um pouco mais para eu te ajudar?";
  }

  // 5) Resposta: texto ou áudio (quando o lead falou por áudio e a voz está ligada).
  const wantsAudio =
    agent.voice_enabled && ["audio", "ptt"].includes(String(inbound.type ?? "").toLowerCase());

  if (wantsAudio) {
    const voice = await xjSynthesize(supabase, {
      clientId: session.client_id,
      text: finalText,
      provider: agent.voice_provider ?? "elevenlabs",
      voiceId: agent.voice_id,
      settings: agent.voice_settings,
      keyMode: (agent as any).voice_key_mode ?? "default",
    });
    if ("url" in voice) {
      const sent = await xjSend(supabase, ctx.queue, session, finalText, {
        type: "audio",
        mediaUrl: voice.url,
        caption: finalText,
      });
      if (!sent.ok) await xjSendComposed(supabase, ctx.queue, session, finalText);
    } else {
      await xjSendComposed(supabase, ctx.queue, session, finalText);
    }
  } else {
    const sent = await xjSendComposed(supabase, ctx.queue, session, finalText);
    if (!sent.ok) {
      await logXJEvent(supabase, session, { kind: "send", status: "error", detail: sent.error ?? "falha" });
    }
  }

  // 6) Programa o followup se o atendimento continua ativo.
  if (!ctx.stop && session.is_active) {
    await scheduleNextFollowup(supabase, session, 1);
  }

  await logXJEvent(supabase, session, {
    kind: "turn",
    detail: finalText.slice(0, 500),
    duration_ms: Date.now() - started,
  });

  return { reply: finalText, stage: session.stage };
}