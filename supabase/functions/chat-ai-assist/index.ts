// AI assistant for chat: summarize conversation or suggest reply.
// Uses Lovable AI Gateway (LOVABLE_API_KEY).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchEffectiveQueueFlags } from "../_shared/agentSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const DEFAULT_RESUME_PROMPT = `Você é um analista de atendimento. Gere um RESUMO OBJETIVO em português da conversa abaixo, priorizando os RELATOS DO CLIENTE (situação, dores, pedidos, dados pessoais relevantes ao caso). Mencione respostas do atendente APENAS quando forem indispensáveis para entender o caso (ex.: instrução crítica, compromisso assumido, encaminhamento). Use os resumos anteriores fornecidos como CONTEXTO acumulado; não os repita, apenas incorpore o que ainda for relevante. Saída em até 6 bullets curtos. Comece com 1 frase em negrito identificando o caso. Não invente informações.`;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getModel(clientId: string | null, feature: string): Promise<string> {
  if (!clientId) return DEFAULT_MODEL;
  const { data } = await supabase
    .from("client_ai_model_config")
    .select("model")
    .eq("client_id", clientId)
    .eq("feature", feature)
    .maybeSingle();
  return data?.model ?? DEFAULT_MODEL;
}

async function getPrompt(clientId: string | null, feature: string, fallback: string): Promise<string> {
  if (!clientId) return fallback;
  const { data } = await supabase
    .from("client_ai_model_config")
    .select("prompt")
    .eq("client_id", clientId)
    .eq("feature", feature)
    .maybeSingle();
  const p = (data?.prompt ?? "").trim();
  return p.length > 0 ? p : fallback;
}

function renderMessageForTranscript(m: {
  text?: string | null;
  from_me?: boolean | null;
  sender_name?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const who = m.from_me ? "Atendente" : "Cliente";
  const sender = m.sender_name ? ` (${m.sender_name})` : "";
  const t = (m.type ?? "text").toLowerCase();
  if (t === "audio" || t === "ptt") {
    const meta = m.metadata as Record<string, unknown> | null | undefined;
    const tr = meta && typeof meta === "object" ? (meta as { transcription?: { text?: string } }).transcription : undefined;
    const transcriptText = tr?.text?.trim();
    if (transcriptText) {
      return `${who}${sender}: [Áudio transcrito] ${transcriptText}`;
    }
    return `${who}${sender}: [Áudio sem transcrição]`;
  }
  if (!m.text) return null;
  return `${who}${sender}: ${m.text}`;
}

/**
 * Returns true if the agent linked to the conversation's queue has the
 * matching AUTO_SUMMARY flag enabled. If ANY linked agent has it on, summary
 * is allowed. Defaults to `false` on any lookup error.
 */
async function isAutoSummaryAllowed(
  conversationId: string,
  triggeredBy: "auto_resolve" | "auto_close",
): Promise<boolean> {
  try {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("client_id, queue_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv?.client_id) return false;
    const flags = await fetchEffectiveQueueFlags(conv.client_id, conv.queue_id ?? null);
    if (triggeredBy === "auto_resolve") return flags.autoSummaryOnResolve;
    if (triggeredBy === "auto_close") return flags.autoSummaryOnClose;
    return false;
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      conversation_id,
      mode,
      after_ts,
      client_id,
      triggered_by,
      insert_internal_note,
    } = body;
    const validModes = ["summary", "suggest", "sentiment", "full_summary", "incremental_summary"];
    if (!conversation_id || !validModes.includes(mode)) {
      return json({ error: "conversation_id and valid mode required", received: { conversation_id, mode } }, 200);
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const model = await getModel(client_id ?? null, "chat_assist");

    if (mode === "incremental_summary") {
      const resumeModel = await getModel(client_id ?? null, "chat_resume");
      const resumePrompt = await getPrompt(client_id ?? null, "chat_resume", DEFAULT_RESUME_PROMPT);

      // Find the most recent summary for this conversation
      const { data: lastSummary } = await supabase
        .from("chat_conversation_summaries")
        .select("summary, first_message_ts, last_message_ts, created_at")
        .eq("conversation_id", conversation_id)
        .order("last_message_ts", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      // Load up to 10 previous summaries for accumulated context
      const { data: previousSummaries } = await supabase
        .from("chat_conversation_summaries")
        .select("summary, first_message_ts, last_message_ts, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true })
        .limit(10);

      // Build messages query
      let msgQuery = supabase
        .from("chat_messages")
        .select("id, text, from_me, sender_name, timestamp, type, metadata")
        .eq("conversation_id", conversation_id)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (lastSummary?.last_message_ts) {
        msgQuery = msgQuery.gt("timestamp", lastSummary.last_message_ts);
      }

      const { data: msgsDesc } = await msgQuery;
      const msgs = (msgsDesc || []).slice().reverse();

      // Audios without transcription are intentionally NOT auto-transcribed
      // here. Transcription is only generated on manual user click in the UI.
      const lines = msgs.map(renderMessageForTranscript).filter((x): x is string => !!x);
      if (lines.length === 0) {
        return json({ error: "Sem mensagens novas para resumir", message_count: 0 }, 200);
      }

      const transcript = lines.join("\n");
      const first_message_ts = msgs[0]?.timestamp ?? null;
      const last_message_ts = msgs[msgs.length - 1]?.timestamp ?? null;
      const message_count = msgs.length;

      const previousBlock = (previousSummaries || [])
        .filter((s) => s.summary)
        .map((s, i) => `--- Resumo ${i + 1} (${s.first_message_ts ?? "?"} → ${s.last_message_ts ?? "?"}) ---\n${s.summary}`)
        .join("\n\n");

      const userContent = previousBlock
        ? `RESUMOS ANTERIORES (contexto acumulado, não repetir):\n${previousBlock}\n\nCONVERSA ATUAL (novas mensagens a resumir):\n${transcript}`
        : `CONVERSA (resuma desde o início):\n${transcript}`;

      const resp = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resumeModel,
          messages: [
            { role: "system", content: resumePrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (resp.status === 429) return json({ error: "Limite de uso da IA atingido." }, 429);
      if (resp.status === 402) return json({ error: "Créditos da IA esgotados." }, 402);
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: "AI error", detail: t }, 500);
      }

      const aiData = await resp.json();
      const summary = aiData?.choices?.[0]?.message?.content ?? "";

      // Persist summary + (optionally) post an internal note in the chat timeline.
      // Gating by agent automation flags (AUTO_SUMMARY_ON_RESOLVE / _ON_CLOSE)
      // happens here so bulk closures (which don't trigger this mode) are safe.
      let persisted_id: string | null = null;
      let note_id: string | null = null;
      try {
        if (insert_internal_note && (triggered_by === "auto_resolve" || triggered_by === "auto_close")) {
          const allowed = await isAutoSummaryAllowed(conversation_id, triggered_by);
          if (!allowed) {
            return json({
              summary,
              first_message_ts,
              last_message_ts,
              message_count,
              model: resumeModel,
              skipped: "agent_flag_disabled",
            });
          }
        }

        // Look up contact_id + client_id for persistence
        const { data: conv } = await supabase
          .from("chat_conversations")
          .select("contact_id, client_id")
          .eq("id", conversation_id)
          .maybeSingle();

        if (conv && summary) {
          const { data: inserted } = await supabase
            .from("chat_conversation_summaries")
            .insert({
              conversation_id,
              contact_id: conv.contact_id,
              client_id: conv.client_id,
              summary,
              first_message_ts,
              last_message_ts,
              message_count,
              triggered_by: triggered_by || "manual",
            })
            .select("id")
            .maybeSingle();
          persisted_id = inserted?.id ?? null;

          if (insert_internal_note && (triggered_by === "auto_resolve" || triggered_by === "auto_close")) {
            const heading = triggered_by === "auto_resolve"
              ? "📋 Resumo automático (resolvida)"
              : "📋 Resumo automático (encerrada)";
            const { data: note } = await supabase
              .from("chat_messages")
              .insert({
                conversation_id,
                contact_id: conv.contact_id,
                client_id: conv.client_id,
                type: "text",
                from_me: true,
                status: "sent",
                internal_note: true,
                note_type: "info",
                text: `${heading}\n\n${summary}`,
                sender_name: "Atende Julia · IA",
                channel_type: "internal_note",
                timestamp: new Date().toISOString(),
                metadata: {
                  internal_note: true,
                  note_type: "info",
                  kind: "auto_summary",
                  triggered_by,
                  summary_id: persisted_id,
                  model: resumeModel,
                },
              })
              .select("id")
              .maybeSingle();
            note_id = note?.id ?? null;
          }
        }
      } catch (persistErr) {
        console.warn("[chat-ai-assist] persist/note error:", persistErr);
      }

      return json({
        summary,
        first_message_ts,
        last_message_ts,
        message_count,
        model: resumeModel,
        persisted_id,
        note_id,
      });
    }

    if (mode === "full_summary") {
      let query = supabase
        .from("chat_messages")
        .select("text, from_me, sender_name, timestamp, type")
        .eq("conversation_id", conversation_id)
        .order("timestamp", { ascending: true })
        .limit(200);

      if (after_ts) {
        query = query.gt("timestamp", after_ts);
      }

      const { data: msgs } = await query;
      const filtered = (msgs || []).filter((m) => m.text);
      if (filtered.length === 0) return json({ error: "Sem mensagens novas para resumir" }, 200);

      const transcript = filtered
        .map((m) => `${m.from_me ? "Atendente" : "Cliente"} (${m.sender_name || ""}): ${m.text}`)
        .join("\n");

      const first_message_ts = filtered[0]?.timestamp ?? null;
      const last_message_ts = filtered[filtered.length - 1]?.timestamp ?? null;
      const message_count = filtered.length;

      const prompt = `Analise a conversa abaixo e responda APENAS com JSON válido no formato:
{
  "sentiment": "Sentimento: [positivo/neutro/negativo/frustrado] — [explicação curta de 1 linha]",
  "summary": "• bullet 1\\n• bullet 2\\n• bullet 3",
  "atendimento": "Como foi o atendimento: [análise curta de 1-2 linhas sobre qualidade, tempo de resposta, cordialidade]"
}
Faça o resumo das conversas até agora. Pode sugerir melhorias.

Conversa:
${transcript}`;

      const resp = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "user", content: prompt },
          ],
        }),
      });

      if (resp.status === 429) return json({ error: "Limite de uso da IA atingido." }, 429);
      if (resp.status === 402) return json({ error: "Créditos da IA esgotados." }, 402);
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: "AI error", detail: t }, 500);
      }

      const aiData = await resp.json();
      const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, string> = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        parsed = { summary: raw, sentiment: "", atendimento: "" };
      }

      return json({
        sentiment: parsed.sentiment ?? "",
        summary: parsed.summary ?? raw,
        atendimento: parsed.atendimento ?? "",
        first_message_ts,
        last_message_ts,
        message_count,
      });
    }

    // Existing modes: summary, suggest, sentiment
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("text, from_me, sender_name, timestamp, type")
      .eq("conversation_id", conversation_id)
      .order("timestamp", { ascending: true })
      .limit(80);

    const transcript = (msgs || [])
      .filter((m) => m.text)
      .map((m) => `${m.from_me ? "Atendente" : "Cliente"} (${m.sender_name || ""}): ${m.text}`)
      .join("\n");

    if (!transcript) return json({ result: "Conversa sem mensagens." });

    const systemByMode: Record<string, string> = {
      summary: "Você é um assistente que resume conversas de atendimento ao cliente em 3-5 bullets curtos em português, destacando: motivo do contato, status atual, próximos passos pendentes.",
      suggest: "Você é um assistente de atendimento. Sugira UMA resposta curta, cordial e profissional em português para o atendente enviar agora ao cliente, com base no histórico. Retorne apenas o texto da resposta, sem prefixos.",
      sentiment: "Analise o sentimento geral do cliente na conversa. Responda em UMA linha em português: 'Sentimento: [positivo/neutro/negativo/frustrado] — [explicação curta]'.",
    };

    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemByMode[mode] },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: "Limite de uso da IA atingido. Tente em instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: "AI error", detail: t }, 500);
    }
    const data = await resp.json();
    const result = data?.choices?.[0]?.message?.content ?? "";
    return json({ result, mode });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
