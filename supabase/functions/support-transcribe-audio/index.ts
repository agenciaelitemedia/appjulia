import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAI, providerHeaders } from "../_shared/aiGateway.ts";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedMessageIds = Array.isArray(requestBody?.messageIds)
      ? requestBody.messageIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supportAI = await resolveAI(supabase, "support_transcription");
    if (!supportAI.apiKey) {
      console.error("[transcribe] AI key not configured");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get UaZapi config for /message/download
    const { data: config } = await supabase
      .from("support_assistant_config")
      .select("api_url, instance_name, instance_token, api_key")
      .limit(1)
      .maybeSingle();

    if (!config?.api_url || !config?.instance_name) {
      console.error("[transcribe] UaZapi config missing");
      return new Response(JSON.stringify({ error: "UaZapi config missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = config.instance_token || config.api_key || "";
    const baseUrl = config.api_url.replace(/\/$/, "");
    const instanceName = config.instance_name;

    // Fetch untranscribed messages (audio + image), limit 10 per run
    let messagesQuery = supabase
      .from("support_group_messages")
      .select("id, media_url, message_id, message_type, sender_name, sender_role, group_name, raw_payload")
      .eq("is_transcribed", false)
      .in("message_type", ["audio", "image"])
      .order("created_at", { ascending: true })
      .limit(requestedMessageIds.length > 0 ? requestedMessageIds.length : 10);

    if (requestedMessageIds.length > 0) {
      messagesQuery = messagesQuery.in("message_id", requestedMessageIds);
    }

    const { data: messages, error: fetchError } = await messagesQuery;

    if (fetchError) {
      console.error("[transcribe] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[transcribe] Processing ${messages.length} media messages`, requestedMessageIds.length > 0 ? `requested=${requestedMessageIds.join(",")}` : "batch=auto");
    let processed = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        // Extract the original message ID for UaZapi download
        const msgId = msg.message_id
          || msg.raw_payload?.message?.id
          || msg.raw_payload?.message?.messageid
          || null;

        if (!msgId) {
          console.warn(`[transcribe] No message_id for ${msg.id}, marking unavailable`);
          await supabase
            .from("support_group_messages")
            .update({
              is_transcribed: true,
              transcription: "[Mídia indisponível - sem ID da mensagem]",
            })
            .eq("id", msg.id);
          errors++;
          continue;
        }

        // Download decrypted media via UaZapi /message/download
        console.log(`[transcribe] Downloading media for ${msg.id} via /message/download msgId=${msgId}`);
        const downloadResp = await fetch(`${baseUrl}/message/download`, {
          method: "POST",
          headers: {
            "token": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: msgId,
            return_base64: true,
            return_link: false,
            generate_mp3: false,
          }),
        });

        if (!downloadResp.ok) {
          const errText = await downloadResp.text();
          console.warn(`[transcribe] Download failed for ${msg.id}: ${downloadResp.status} ${errText}`);
          await supabase
            .from("support_group_messages")
            .update({
              is_transcribed: true,
              transcription: "[Transcrição indisponível - mídia expirada]",
            })
            .eq("id", msg.id);
          errors++;
          continue;
        }

        const downloadData = await downloadResp.json();
        console.log(`[transcribe] Download OK for ${msg.id}, mimetype: ${downloadData.mimetype || "unknown"}`);
        const base64Data = downloadData.base64Data || downloadData.base64 || downloadData.data || downloadData.file || null;
        const mimetype = downloadData.mimetype || downloadData.mimeType || downloadData.mime || (msg.message_type === "audio" ? "audio/ogg" : "image/jpeg");

        if (!base64Data) {
          console.warn(`[transcribe] No base64 in download response for ${msg.id}`);
          await supabase
            .from("support_group_messages")
            .update({
              is_transcribed: true,
              transcription: "[Transcrição indisponível - download sem dados]",
            })
            .eq("id", msg.id);
          errors++;
          continue;
        }

        const roleLabel = msg.sender_role === "suporte" ? `suporte ${msg.sender_name || ""}`.trim() : "cliente";

        if (msg.message_type === "audio") {
          // Transcribe audio via configured provider (Lovable default / OpenRouter)
          const startedAt = Date.now();
          const aiResp = await fetch(supportAI.endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supportAI.apiKey}`,
              "Content-Type": "application/json",
              ...providerHeaders(supportAI.provider),
            },
            body: JSON.stringify({
              model: supportAI.model,
              messages: [
                {
                  role: "system",
                  content: supportAI.prompt ?? "Você é um transcritor de áudio. Transcreva o áudio fornecido fielmente em português brasileiro. Retorne APENAS a transcrição, sem comentários adicionais. Se não conseguir entender o áudio, retorne '[Áudio inaudível]'."
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "input_audio",
                      input_audio: {
                        data: base64Data,
                        format: mimetype.includes("ogg") ? "ogg" : mimetype.includes("mp4") ? "mp4" : "wav",
                      }
                    },
                    { type: "text", text: "Transcreva este áudio:" }
                  ],
                }
              ],
            }),
          });
          const durationMs = Date.now() - startedAt;

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            console.warn(`[transcribe] AI error for ${msg.id}:`, aiResp.status, errText);
            await logAIUsage(supabase, {
              feature: "support_transcription",
              provider: supportAI.provider,
              endpoint: supportAI.endpoint,
              model: supportAI.model,
              status: "failed",
              duration_ms: durationMs,
              error_reason: `ai_${aiResp.status}`,
              context: { message_id: msg.id, mimetype },
            });
            errors++;
            continue;
          }

          const aiData = await aiResp.json();
          const transcription = aiData.choices?.[0]?.message?.content?.trim() || "[Transcrição indisponível]";

          await supabase
            .from("support_group_messages")
            .update({
              transcription,
              is_transcribed: true,
              message_text: `🎤 Áudio do ${roleLabel}: "${transcription}"`,
            })
            .eq("id", msg.id);

          await logAIUsage(supabase, {
            feature: "support_transcription",
            provider: supportAI.provider,
            endpoint: supportAI.endpoint,
            model: supportAI.model,
            status: "ok",
            duration_ms: durationMs,
            usage: aiData?.usage,
            audio_seconds: (downloadData as any)?.seconds ?? (downloadData as any)?.duration ?? null,
            context: { message_id: msg.id, mimetype, text_length: transcription.length },
          });

          processed++;
          console.log(`[transcribe] Transcribed audio ${msg.id}`);

        } else if (msg.message_type === "image") {
          // Describe image via configured provider (Lovable default / OpenRouter)
          const startedAt = Date.now();
          const aiResp = await fetch(supportAI.endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supportAI.apiKey}`,
              "Content-Type": "application/json",
              ...providerHeaders(supportAI.provider),
            },
            body: JSON.stringify({
              model: supportAI.model,
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente que descreve imagens de forma concisa e objetiva em português brasileiro. Descreva o conteúdo da imagem em uma frase curta (máx 100 caracteres). Se for captura de tela de conversa, diga o assunto. Se for documento, diga o tipo. Retorne APENAS a descrição."
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimetype};base64,${base64Data}`,
                      }
                    },
                    { type: "text", text: "Descreva esta imagem de forma concisa:" }
                  ],
                }
              ],
            }),
          });
          const durationMs = Date.now() - startedAt;

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            console.warn(`[transcribe] AI image error for ${msg.id}:`, aiResp.status, errText);
            await logAIUsage(supabase, {
              feature: "support_image_describe",
              provider: supportAI.provider,
              endpoint: supportAI.endpoint,
              model: supportAI.model,
              status: "failed",
              duration_ms: durationMs,
              error_reason: `ai_${aiResp.status}`,
              context: { message_id: msg.id, mimetype },
            });
            errors++;
            continue;
          }

          const aiData = await aiResp.json();
          const description = aiData.choices?.[0]?.message?.content?.trim() || "imagem";

          await supabase
            .from("support_group_messages")
            .update({
              transcription: description,
              is_transcribed: true,
              message_text: `📷 Imagem do ${roleLabel}: ${description}`,
            })
            .eq("id", msg.id);

          await logAIUsage(supabase, {
            feature: "support_image_describe",
            provider: supportAI.provider,
            endpoint: supportAI.endpoint,
            model: supportAI.model,
            status: "ok",
            duration_ms: durationMs,
            usage: aiData?.usage,
            context: { message_id: msg.id, mimetype, text_length: description.length },
          });

          processed++;
          console.log(`[transcribe] Described image ${msg.id}`);
        }
      } catch (innerErr) {
        console.error(`[transcribe] Error processing ${msg.id}:`, innerErr);
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
