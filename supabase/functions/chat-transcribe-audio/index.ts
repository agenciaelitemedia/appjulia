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
import { resolveAI, lovableAI, providerHeaders, OPENROUTER_TRANSCRIBE_ENDPOINT } from "../_shared/aiGateway.ts";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";
import { fetchEffectiveQueueFlags } from "../_shared/agentSettings.ts";

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

function isWabaChannel(msg: any, queue: any): boolean {
  const ct = String(queue?.channel_type ?? msg?.channel_type ?? "").toLowerCase();
  if (ct === "waba" || ct === "whatsapp_waba") return true;
  if (String(queue?.hub ?? "").toLowerCase() === "waba") return true;
  if (typeof msg?.media_url === "string" && msg.media_url.startsWith("waba_media:")) return true;
  return false;
}

function extractWabaMediaId(msg: any): string | null {
  if (typeof msg?.media_url === "string" && msg.media_url.startsWith("waba_media:")) {
    return msg.media_url.replace("waba_media:", "").trim() || null;
  }
  if (msg?.metadata?.waba_media_id) return String(msg.metadata.waba_media_id);
  const raw = msg?.raw_payload || {};
  for (const k of ["audio", "voice", "video", "document"]) {
    if (raw?.[k]?.id) return String(raw[k].id);
  }
  if (raw?.media?.id) return String(raw.media.id);
  return null;
}

async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messageId: string | undefined = body?.message_id;
    const force: boolean = body?.force === true;
    // Uso interno (ex.: X-Julia): transcreve mesmo sem a feature liberada, mas
    // grava em chave separada para não exibir no chat até que seja permitido.
    const internal: boolean = body?.internal === true;
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
      .select("id, client_id, type, conversation_id, message_id, external_id, metadata, media_url, channel_type, raw_payload")
      .eq("id", messageId)
      .maybeSingle();

    if (msgErr || !msg) {
      return ok({ ok: false, error: "message not found", reason: "not_found" });
    }

    if (!["audio", "ptt"].includes(msg.type)) {
      return ok({ ok: true, skipped: "not_audio" });
    }

    const existing = msg.metadata?.transcription?.status === 'ok' && msg.metadata?.transcription?.text
      ? msg.metadata.transcription
      : (msg.metadata?.transcription_internal?.status === 'ok' && msg.metadata?.transcription_internal?.text
          ? msg.metadata.transcription_internal
          : null);
    if (!force && existing) {
      return ok({ ok: true, skipped: "already_transcribed", text: existing.text });
    }

    // 2) Load queue credentials via conversation
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("queue_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    if (!conv?.queue_id) {
      await markFailed(supabase, msg, "queue_not_found", internal);
      return ok({ ok: false, error: "queue not found", reason: "queue_not_found" });
    }

    const { data: queue } = await supabase
      .from("queues")
      .select("id, channel_type, hub, evo_url, evo_apikey, waba_token, waba_number_id, client_id")
      .eq("id", conv.queue_id)
      .maybeSingle();

    const wabaMode = isWabaChannel(msg, queue);

    // Chave de metadata: interna quando a feature não está liberada no client+fila.
    let metaKey = "transcription";
    if (internal) {
      try {
        const flags = await fetchEffectiveQueueFlags(msg.client_id, conv.queue_id);
        metaKey = flags.autoTranscribeAudio ? "transcription" : "transcription_internal";
      } catch (_e) {
        metaKey = "transcription_internal";
      }
    }

    // 3) Download audio (channel-aware)
    let base64Data: string | null = null;
    let mimetype = "audio/ogg";
    let audioUrl: string | null = null;
    let audioDurationS: number | null = null;
    let extId: string | null = msg.external_id || msg.message_id || null;

    if (wabaMode) {
      // 3a) WABA (API Oficial): prefer already-persisted media, else Graph API via waba-send
      const persisted =
        typeof msg.media_url === "string" &&
        /^https?:\/\//i.test(msg.media_url) &&
        !msg.media_url.startsWith("waba_media:")
          ? msg.media_url
          : null;

      if (persisted) {
        const res = await fetch(persisted);
        if (!res.ok) {
          await markFailed(supabase, msg, "download_failed", internal);
          return ok({ ok: false, error: "download failed", reason: "download_failed", status: res.status });
        }
        mimetype = res.headers.get("content-type") || "audio/ogg";
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > MAX_BASE64_BYTES) {
          await markFailed(supabase, msg, "audio_too_large", internal);
          return ok({ ok: false, error: "audio too large", reason: "audio_too_large" });
        }
        base64Data = await bytesToBase64(bytes);
        audioUrl = persisted;
      } else {
        let wabaQueue = queue?.waba_token && queue?.waba_number_id ? queue : null;
        if (!wabaQueue) {
          const { data } = await supabase
            .from("queues")
            .select("id, waba_token, waba_number_id")
            .eq("client_id", msg.client_id)
            .in("channel_type", ["whatsapp_waba", "waba"])
            .not("waba_token", "is", null)
            .not("waba_number_id", "is", null)
            .limit(1)
            .maybeSingle();
          if (data) wabaQueue = data as any;
        }
        if (!wabaQueue) {
          await markFailed(supabase, msg, "waba_credentials_missing", internal);
          return ok({ ok: false, error: "waba credentials missing", reason: "waba_credentials_missing" });
        }

        const mediaId = extractWabaMediaId(msg);
        if (!mediaId) {
          // Outbound/API-logged audio with no stored media: nothing to transcribe.
          if (!msg.media_url && !msg.raw_payload) {
            await markFailed(supabase, msg, "no_media", internal);
            return ok({ ok: false, error: "no media stored", reason: "no_media" });
          }
          await markFailed(supabase, msg, "waba_media_id_missing", internal);
          return ok({ ok: false, error: "waba media id missing", reason: "waba_media_id_missing" });
        }
        extId = extId || mediaId;

        const { data: dlData, error: dlErr } = await supabase.functions.invoke("waba-send", {
          body: { action: "download_media", queue_id: wabaQueue.id, media_id: mediaId },
        });
        if (dlErr || !dlData?.base64) {
          console.warn("[chat-transcribe-audio] waba download failed:", dlErr?.message || dlData?.error);
          await markFailed(supabase, msg, "download_failed", internal);
          return ok({ ok: false, error: "download failed", reason: "download_failed" });
        }
        base64Data = dlData.base64;
        mimetype = dlData.mimetype || msg.metadata?.mimetype || "audio/ogg";
      }
    } else {
      // 3b) UaZapi: decrypt via /message/download
      if (!queue?.evo_url || !queue?.evo_apikey) {
        await markFailed(supabase, msg, "queue_credentials_missing", internal);
        return ok({ ok: false, error: "queue uazapi credentials missing", reason: "queue_credentials_missing" });
      }
      if (!extId) {
        await markFailed(supabase, msg, "external_id_missing", internal);
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
        await markFailed(supabase, msg, "download_failed", internal);
        return ok({ ok: false, error: "download failed", reason: "download_failed", status: downloadResp.status });
      }

      const dl = await downloadResp.json();
      base64Data = dl.base64Data || dl.base64 || dl.data || dl.file || null;
      mimetype = dl.mimetype || dl.mimeType || dl.mime || "audio/ogg";
      audioUrl = dl.url || dl.fileURL || dl.link || null;
      audioDurationS = dl.seconds || dl.duration || null;
    }

    if (!base64Data) {
      await markFailed(supabase, msg, "no_base64", internal);
      return ok({ ok: false, error: "no base64 in download response", reason: "no_base64" });
    }

    if (typeof base64Data === "string" && base64Data.length > MAX_BASE64_BYTES) {
      await markFailed(supabase, msg, "audio_too_large", internal);
      return ok({ ok: false, error: "audio too large", reason: "audio_too_large" });
    }

    // 4) Transcribe via configured provider (Lovable chat / OpenRouter audio)
    let ai = await resolveAI(supabase, "chat_transcription");
    const prompt = ai.prompt ?? DEFAULT_PROMPT;
    if (!ai.apiKey) {
      await markFailed(supabase, msg, "no_api_key", internal);
      return ok({ ok: false, error: "IA não configurada (sem chave)", reason: "no_api_key" });
    }
    const format = mimetype.includes("mp4") || mimetype.includes("m4a") ? "mp4"
      : mimetype.includes("wav") ? "wav"
      : mimetype.includes("mp3") || mimetype.includes("mpeg") ? "mp3"
      : "ogg";

    // For OpenRouter we use the dedicated audio transcription endpoint;
    // for Lovable we use the chat-completions gateway with input_audio.
    const endpointFor = (cfg: typeof ai) =>
      cfg.provider === "openrouter" ? OPENROUTER_TRANSCRIBE_ENDPOINT : cfg.endpoint;

    const callAI = async (cfg: typeof ai) => {
      const started = Date.now();
      const isOR = cfg.provider === "openrouter";
      const reqBody = isOR
        ? {
            input_audio: { data: base64Data, format },
            model: cfg.model,
            language: LANG_PT,
          }
        : {
            model: cfg.model,
            messages: [
              { role: "system", content: cfg.prompt ?? prompt },
              {
                role: "user",
                content: [
                  { type: "input_audio", input_audio: { data: base64Data, format } },
                  { type: "text", text: "Transcreva este áudio:" },
                ],
              },
            ],
          };
      const resp = await fetch(endpointFor(cfg), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          ...providerHeaders(cfg.provider),
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

    let { resp: aiResp, ms: durationMs } = await callAI(ai);
    let fallbackFrom: string | null = null;

    // Fallback: provedor externo recusou por cobrança/autorização → tenta Lovable AI.
    if (!aiResp.ok && ai.provider === "openrouter" && [401, 402, 403].includes(aiResp.status)) {
      const firstStatus = aiResp.status;
      const errTxt = await aiResp.text().catch(() => "");
      console.warn(`[chat-transcribe-audio] OpenRouter ${firstStatus}; caindo para Lovable AI: ${errTxt}`);
      await logAIUsage(supabase, {
        client_id: msg.client_id,
        feature: "chat_transcription",
        provider: ai.provider,
        endpoint: endpointFor(ai),
        model: ai.model,
        status: "failed",
        duration_ms: durationMs,
        error_reason: `ai_${firstStatus}`,
        audio_seconds: audioDurationS,
        context: contextBase,
      });
      const fallbackCfg = lovableAI("chat_transcription", prompt);
      if (fallbackCfg.apiKey) {
        fallbackFrom = "openrouter";
        ai = fallbackCfg;
        const retry = await callAI(ai);
        aiResp = retry.resp;
        durationMs = retry.ms;
      }
    }

    const effectiveEndpoint = endpointFor(ai);
    const useOpenRouterTranscribe = ai.provider === "openrouter";
    const usedModel = ai.model;

    if (!aiResp.ok) {
      const errTxt = await aiResp.text().catch(() => "");
      console.warn(`[chat-transcribe-audio] AI error ${aiResp.status} (provider=${ai.provider} model=${ai.model}): ${errTxt}`);
      await markFailed(supabase, msg, `ai_${aiResp.status}`, internal);
      await logAIUsage(supabase, {
        client_id: msg.client_id,
        feature: "chat_transcription",
        provider: ai.provider,
        endpoint: effectiveEndpoint,
        model: usedModel,
        status: "failed",
        duration_ms: durationMs,
        error_reason: `ai_${aiResp.status}`,
        audio_seconds: audioDurationS,
        context: { ...contextBase, ...(fallbackFrom ? { fallback_from: fallbackFrom } : {}) },
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
      [metaKey]: {
        text,
        model: usedModel,
        generated_at: new Date().toISOString(),
        status: "ok",
        endpoint: effectiveEndpoint,
        provider: ai.provider,
      },
    };

    await supabase.from("chat_messages").update({ metadata: newMeta }).eq("id", msg.id);

    await logAIUsage(supabase, {
      client_id: msg.client_id,
      feature: "chat_transcription",
      provider: ai.provider,
      endpoint: effectiveEndpoint,
      model: usedModel,
      status: "ok",
      duration_ms: durationMs,
      usage,
      audio_seconds: audioDurationS,
      context: { ...contextBase, text_length: text.length, ...(fallbackFrom ? { fallback_from: fallbackFrom } : {}) },
    });

    return ok({ ok: true, message_id: msg.id, length: text.length, model: usedModel, status: "ok", text, internal: metaKey === "transcription_internal" });
  } catch (err) {
    console.error("[chat-transcribe-audio] error:", err);
    return ok({ ok: false, error: String(err), reason: "exception" });
  }
});

async function markFailed(supabase: any, msg: any, reason: string, internal = false) {
  try {
    const key = internal ? "transcription_internal" : "transcription";
    const newMeta = {
      ...(msg.metadata || {}),
      [key]: {
        text: null,
        status: "failed",
        reason,
        generated_at: new Date().toISOString(),
      },
    };
    await supabase.from("chat_messages").update({ metadata: newMeta }).eq("id", msg.id);
  } catch (_e) { /* ignore */ }
}