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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Você é um transcritor de áudio profissional. Transcreva o áudio fornecido fielmente em português brasileiro, preservando pontuação e parágrafos. Retorne APENAS a transcrição, sem comentários. Se inaudível, retorne '[Áudio inaudível]'.";

async function getTranscriptionPrompt(supabase: any, clientId: string | null): Promise<{ prompt: string; model: string }> {
  let prompt = DEFAULT_PROMPT;
  let model = "google/gemini-2.5-flash";
  if (!clientId) return { prompt, model };
  try {
    const { data } = await supabase
      .from("client_ai_model_config")
      .select("provider, model, prompt")
      .eq("client_id", clientId)
      .eq("feature", "chat_transcription")
      .maybeSingle();
    if (data?.prompt) prompt = data.prompt;
    if (data?.model) {
      const prov = data.provider || "google";
      model = data.model.includes("/") ? data.model : `${prov}/${data.model}`;
    }
  } catch (_e) { /* use defaults */ }
  return { prompt, model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messageId: string | undefined = body?.message_id;
    if (!messageId) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["audio", "ptt"].includes(msg.type)) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_audio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (msg.metadata?.transcription?.text) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_transcribed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Load queue credentials via conversation
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("queue_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    if (!conv?.queue_id) {
      return new Response(JSON.stringify({ error: "queue not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: queue } = await supabase
      .from("queues")
      .select("evo_url, evo_apikey, hub")
      .eq("id", conv.queue_id)
      .maybeSingle();

    if (!queue?.evo_url || !queue?.evo_apikey) {
      return new Response(JSON.stringify({ error: "queue uazapi credentials missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Download decrypted audio via UaZapi /message/download
    const extId = msg.external_id || msg.message_id;
    if (!extId) {
      return new Response(JSON.stringify({ error: "external_id missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "download failed", status: downloadResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dl = await downloadResp.json();
    const base64Data = dl.base64Data || dl.base64 || dl.data || dl.file || null;
    const mimetype: string = dl.mimetype || dl.mimeType || dl.mime || "audio/ogg";

    if (!base64Data) {
      await markFailed(supabase, msg, "no_base64");
      return new Response(JSON.stringify({ error: "no base64 in download response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Transcribe via Lovable AI
    const { prompt, model } = await getTranscriptionPrompt(supabase, msg.client_id);
    const format = mimetype.includes("mp4") || mimetype.includes("m4a") ? "mp4"
      : mimetype.includes("wav") ? "wav"
      : mimetype.includes("mp3") || mimetype.includes("mpeg") ? "mp3"
      : "ogg";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
      }),
    });

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      console.warn(`[chat-transcribe-audio] AI error ${aiResp.status}: ${errTxt}`);
      await markFailed(supabase, msg, `ai_${aiResp.status}`);
      return new Response(JSON.stringify({ error: "ai error", status: aiResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const text: string = aiData?.choices?.[0]?.message?.content?.trim() || "[Transcrição indisponível]";

    const newMeta = {
      ...(msg.metadata || {}),
      transcription: {
        text,
        model,
        generated_at: new Date().toISOString(),
        status: "ok",
      },
    };

    await supabase.from("chat_messages").update({ metadata: newMeta }).eq("id", msg.id);

    return new Response(JSON.stringify({ ok: true, message_id: msg.id, length: text.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[chat-transcribe-audio] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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