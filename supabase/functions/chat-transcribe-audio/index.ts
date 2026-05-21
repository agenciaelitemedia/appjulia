// ============================================
// Chat: Transcribe a single chat_messages audio
// Body: { message_id: string }
// 1) Loads message + queue (UaZapi credentials)
// 2) Downloads decrypted audio via /message/download
// 3) Transcribes via Lovable AI Gateway
// 4) Saves into chat_messages.metadata.transcription
// Fire-and-forget; safe to call multiple times (idempotent: skips if already present).
// ============================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAI, providerHeaders, OPENROUTER_TRANSCRIBE_ENDPOINT } from "../_shared/aiGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Você é um transcritor de áudio profissional. Transcreva o áudio fornecido fielmente em português brasileiro, preservando pontuação e parágrafos. Retorne APENAS a transcrição, sem comentários. Se inaudível, retorne '[Áudio inaudível]'.";

const MAX_BASE64_BYTES = 28_000_000; // ~21MB binário
const LANG_PT = "pt"; // ISO-639-1 pt-BR

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messageId: string | undefined = body?.message_id;
    const force: boolean = body?.force === true;
    if (!messageId) {
      return ok({ ok: false, error: "message_id required", reason: "bad_request" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Load message
    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, client_id, type, conversation_id, message_id, external_id, metadata")
      .eq("id", messageId)
      .maybeSingle();

    if (msgErr || !msg) {
      return ok({ ok: false, error: "message not found", reason: "not_found" });
    }

    if (!["audio", "ptt"].includes(msg.type)) {
      return ok({ ok: true, skipped: "not_audio" });
    }

    if (!force && msg.metadata?.transcription?.text && msg.metadata?.transcription?.status === 'ok') {
      return ok({ ok: true, skipped: "already_transcribed" });
    }

    // 2) Load queue credentials via conversation
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("queue_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    if (!conv?.queue_id) {
      await markFailed(supabase, msg, "queue_not_found");
      return ok({ ok: false, error: "queue not found", reason: "queue_not_found" });
    }

    const { data: queue } = await supabase
      .from("queues")
      .select("evo_url, evo_apikey, hub")
      .eq("id", conv.queue_id)
      .maybeSingle();

    if (!queue?.evo_url || !queue?.evo_apikey) {
      await markFailed(supabase, msg, "queue_credentials_missing");
      return ok({ ok: false, error: "queue uazapi credentials missing", reason: "queue_credentials_missing" });
    }

    // 3) Download decrypted audio via UaZapi /message/download
    const extId = msg.external_id || msg.message_id;
    if (!extId) {
      await markFailed(supabase, msg, "external_id_missing");
      return ok({ ok: false, error: "external_id missing", reason: "external_id_missing" });
    }

    const baseUrl = queue.evo_url.replace(/\/$/, "");
    const downloadResp = await fetch(`${baseUrl}/message/download`, {
      method: "POST",
      headers: { token: queue.evo_apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ id: extId, return_base64: true, return_link: false, generate_mp3: false }),
    });

    if (!downloadResp.ok) {
      const errTxt = await downloadResp.text();
      console.warn(`[chat-transcribe-audio] download failed ${downloadResp.status}: ${errTxt}`);
      await markFailed(supabase, msg, "download_failed");
      return ok({ ok: false, error: "download failed", reason: "download_failed", status: downloadResp.status });
    }

    const dl = await downloadResp.json();
    const base64Data = dl.base64Data || dl.base64 || dl.data || dl.file || null;
    const mimetype: string = dl.mimetype || dl.mimeType || dl.mime || "audio/ogg";
    const audioUrl: string | null = dl.url || dl.fileURL || dl.link || null;
    const audioDurationS: number | null = dl.seconds || dl.duration || null;

    if (!base64Data) {
      await markFailed(supabase, msg, "no_base64");
      return ok({ ok: false, error: "no base64 in download response", reason: "no_base64" });
    }

    if (typeof base64Data === "string" && base64Data.length > MAX_BASE64_BYTES) {
      await markFailed(supabase, msg, "audio_too_large");
      return ok({ ok: false, error: "audio too large", reason: "audio_too_large" });
    }

    // 4) Transcribe via configured provider (Lovable chat / OpenRouter audio)
    const ai = await resolveAI(supabase, "chat_transcription");
    const prompt = ai.prompt ?? DEFAULT_PROMPT;
    if (!ai.apiKey) {
      await markFailed(supabase, msg, "no_api_key");
      return ok({ ok: false, error: "IA não configurada (sem chave)", reason: "no_api_key" });
    }
    const format = mimetype.includes("mp4") || mimetype.includes("m4a") ? "mp4"
      : mimetype.includes("wav") ? "wav"
      : mimetype.includes("mp3") || mimetype.includes("mpeg") ? "mp3"
      : "ogg";

    // For OpenRouter we use the dedicated audio transcription endpoint;
    // for Lovable we use the chat-completions gateway with input_audio.
    const useOpenRouterTranscribe = ai.provider === "openrouter";
    const effectiveEndpoint = useOpenRouterTranscribe ? OPENROUTER_TRANSCRIBE_ENDPOINT : ai.endpoint;

    const callAI = async () => {
      const started = Date.now();
      const reqBody = useOpenRouterTranscribe
        ? {
            input_audio: { data: base64Data, format },
            model: ai.model,
            language: LANG_PT,
          }
        : {
            model: ai.model,
            messages: [
              { role: "system", content: prompt },
              {
                role: "user",
                content: [
                  { type: "input_audio", input_audio: { data: base64Data, format } },
                  { type: "text", text: "Transcreva este áudio:" },
                ],
              },
            ],
          };
      const resp = await fetch(effectiveEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.apiKey}`,
          "Content-Type": "application/json",
          ...providerHeaders(ai.provider),
        },
        body: JSON.stringify(reqBody),
      });
      const ms = Date.now() - started;
      return { resp, ms };
    };

    const contextBase = {
      message_id: msg.id,
      conversation_id: msg.conversation_id,
      external_id: extId,
      mimetype,
      format,
      audio_url: audioUrl,
      audio_duration_s: audioDurationS,
    };

    const { resp: aiResp, ms: durationMs } = await callAI();
    const usedModel = ai.model;

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      console.warn(`[chat-transcribe-audio] AI error ${aiResp.status} (provider=${ai.provider} model=${ai.model}): ${errTxt}`);
      await markFailed(supabase, msg, `ai_${aiResp.status}`);
      await logUsage(supabase, {
        client_id: msg.client_id,
        feature: "chat_transcription",
        provider: ai.provider,
        endpoint: effectiveEndpoint,
        model: usedModel,
        status: "failed",
        duration_ms: durationMs,
        error_reason: `ai_${aiResp.status}`,
        context: contextBase,
      });
      return ok({ ok: false, error: "ai error", reason: `ai_${aiResp.status}` });
    }

    const aiData = await aiResp.json();
    const text: string = useOpenRouterTranscribe
      ? (aiData?.text?.toString().trim() || "[Transcrição indisponível]")
      : (aiData?.choices?.[0]?.message?.content?.trim() || "[Transcrição indisponível]");
    const usage = aiData?.usage ?? {};

    const newMeta = {
      ...(msg.metadata || {}),
      transcription: {
        text,
        model: usedModel,
        generated_at: new Date().toISOString(),
        status: "ok",
        endpoint: effectiveEndpoint,
        provider: ai.provider,
      },
    };

    await supabase.from("chat_messages").update({ metadata: newMeta }).eq("id", msg.id);

    await logUsage(supabase, {
      client_id: msg.client_id,
      feature: "chat_transcription",
      provider: ai.provider,
      endpoint: effectiveEndpoint,
      model: usedModel,
      status: "ok",
      duration_ms: durationMs,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
      context: { ...contextBase, text_length: text.length },
    });

    return ok({ ok: true, message_id: msg.id, length: text.length, model: usedModel, status: "ok" });
  } catch (err) {
    console.error("[chat-transcribe-audio] error:", err);
    return ok({ ok: false, error: String(err), reason: "exception" });
  }
});

async function markFailed(supabase: any, msg: any, reason: string) {
  try {
    const newMeta = {
      ...(msg.metadata || {}),
      transcription: {
        text: null,
        status: "failed",
        reason,
        generated_at: new Date().toISOString(),
      },
    };
    await supabase.from("chat_messages").update({ metadata: newMeta }).eq("id", msg.id);
  } catch (_e) { /* ignore */ }
}

interface UsageRow {
  client_id?: string | null;
  user_id?: string | null;
  feature: string;
  provider: string;
  endpoint: string;
  model: string;
  status: string;
  duration_ms?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  error_reason?: string | null;
  context?: Record<string, unknown>;
}

async function logUsage(supabase: any, row: UsageRow) {
  try {
    await supabase.from("ai_usage_logs").insert({
      client_id: row.client_id ?? null,
      user_id: row.user_id ?? null,
      feature: row.feature,
      provider: row.provider,
      endpoint: row.endpoint,
      model: row.model,
      status: row.status,
      duration_ms: row.duration_ms ?? null,
      prompt_tokens: row.prompt_tokens ?? null,
      completion_tokens: row.completion_tokens ?? null,
      total_tokens: row.total_tokens ?? null,
      error_reason: row.error_reason ?? null,
      context: row.context ?? {},
    });
  } catch (e) {
    console.warn("[chat-transcribe-audio] logUsage failed", e);
  }
}