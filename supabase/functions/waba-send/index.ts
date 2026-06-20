import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// Resilient fetch: retries on 429 (rate-limit) and 5xx errors.
// Respects the Retry-After header from Meta when present.
// ============================================
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastResp: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429) {
      const retryAfter = Number(resp.headers.get("Retry-After") ?? 60);
      console.warn(`[waba-send] rate-limited (429), waiting ${retryAfter}s (attempt ${attempt}/${maxAttempts})`);
      if (attempt < maxAttempts) await sleep(retryAfter * 1000);
      lastResp = resp;
      continue;
    }
    if (resp.status >= 500 && attempt < maxAttempts) {
      const backoff = attempt * 2000;
      console.warn(`[waba-send] server error ${resp.status}, retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})`);
      await sleep(backoff);
      lastResp = resp;
      continue;
    }
    return resp;
  }
  return lastResp!;
}

// ============================================
// Persist outbound message to chat_messages (Meta does NOT echo to webhook)
// ============================================
async function persistOutbound(args: {
  queueId: string | null;
  toPhone: string;
  metaMessageId: string | undefined;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker";
  text?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  senderName?: string | null;
  source?: string | null;
  replyTo?: string | null;
}) {
  try {
    if (!args.queueId) {
      console.warn("[waba-send] persistOutbound skipped: no queue_id");
      return;
    }
    const { data: queue } = await supabase
      .from("queues")
      .select("id, client_id")
      .eq("id", args.queueId)
      .maybeSingle();
    if (!queue?.client_id) {
      console.warn(`[waba-send] persistOutbound skipped: queue ${args.queueId} has no client_id`);
      return;
    }
    const clientId = queue.client_id as string;
    const cleanPhone = args.toPhone.replace(/\D/g, "");

    // Upsert contact
    let contactId: string | null = null;
    const { data: existing } = await supabase
      .from("chat_contacts")
      .select("id")
      .eq("client_id", clientId)
      .eq("phone", cleanPhone)
      .maybeSingle();
    if (existing?.id) {
      contactId = existing.id;
      await supabase
        .from("chat_contacts")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: args.text || args.caption || args.type,
        })
        .eq("id", contactId);
    } else {
      const { data: created } = await supabase
        .from("chat_contacts")
        .insert({
          client_id: clientId,
          phone: cleanPhone,
          name: cleanPhone,
          channel_type: "whatsapp_waba",
          channel_source: args.queueId,
          last_message_at: new Date().toISOString(),
          last_message_text: args.text || args.caption || args.type,
        })
        .select("id")
        .maybeSingle();
      contactId = created?.id ?? null;
    }
    if (!contactId) {
      console.warn(`[waba-send] persistOutbound: failed to resolve contact for ${cleanPhone}`);
      return;
    }

    // Resolve or create active conversation
    let conversationId: string | null = null;
    const { data: openConv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("client_id", clientId)
      .eq("queue_id", args.queueId)
      .eq("channel", "whatsapp_waba")
      .in("status", ["pending", "open"])
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openConv?.id) {
      conversationId = openConv.id;
    } else {
      const { data: createdConv } = await supabase
        .from("chat_conversations")
        .insert({
          client_id: clientId,
          contact_id: contactId,
          queue_id: args.queueId,
          channel: "whatsapp_waba",
          status: "open",
          protocol: "",
        })
        .select("id")
        .maybeSingle();
      conversationId = createdConv?.id ?? null;
    }

    // Insert message
    await supabase.from("chat_messages").insert({
      client_id: clientId,
      contact_id: contactId,
      conversation_id: conversationId,
      channel_type: "whatsapp_waba",
      from_me: true,
      status: "sent",
      type: args.type,
      text: args.text ?? null,
      caption: args.caption ?? null,
      media_url: args.mediaUrl ?? null,
      file_name: args.fileName ?? null,
      external_id: args.metaMessageId ?? null,
      message_id: args.metaMessageId ?? null,
      sender_name: args.senderName || "Assistente",
      reply_to: args.replyTo ?? null,
      timestamp: new Date().toISOString(),
      metadata: { source: args.source || "api" },
    });
    console.log(`[waba-send] persisted outbound msg meta_id=${args.metaMessageId} conv=${conversationId}`);

  } catch (e) {
    console.error(`[waba-send] persistOutbound error: ${(e as Error).message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, cod_agent, queue_id, sender_name, source, ...params } = await req.json();

    const phone_number_id_in: string | undefined = params.phone_number_id;

    if (!action || (!cod_agent && !queue_id && !phone_number_id_in)) {
      return new Response(
        JSON.stringify({ error: "action and (queue_id, cod_agent or phone_number_id) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve WABA credentials: prefer queue_id, then phone_number_id (waba_number_id lookup),
    // fallback to cod_agent (legacy: agents table in external DB via db-query)
    let waba_token: string | undefined;
    let phone_number_id: string | undefined;
    let waba_id: string | undefined;
    let resolved_queue_id: string | null = queue_id ?? null;

    if (queue_id) {
      const { data: queue, error: qErr } = await supabase
        .from("queues")
        .select("waba_token, waba_number_id, waba_id, channel_type")
        .eq("id", queue_id)
        .maybeSingle();

      if (qErr || !queue) {
        return new Response(
          JSON.stringify({ error: "Queue not found", details: qErr?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      waba_token = queue.waba_token ?? undefined;
      phone_number_id = queue.waba_number_id ?? undefined;
      waba_id = queue.waba_id ?? undefined;
    } else if (phone_number_id_in) {
      const { data: queue, error: qErr } = await supabase
        .from("queues")
        .select("id, waba_token, waba_number_id, waba_id")
        .eq("waba_number_id", phone_number_id_in)
        .eq("is_active", true)
        .eq("is_deleted", false)
        .limit(1)
        .maybeSingle();

      if (qErr || !queue) {
        return new Response(
          JSON.stringify({ error: "Queue not found for phone_number_id", details: qErr?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolved_queue_id = queue.id;
      waba_token = queue.waba_token ?? undefined;
      phone_number_id = queue.waba_number_id ?? undefined;
      waba_id = queue.waba_id ?? undefined;
    } else {
      const { data: dbResult, error: dbError } = await supabase.functions.invoke("db-query", {
        body: {
          action: "raw",
          data: {
            query: "SELECT waba_token, waba_number_id, waba_id FROM agents WHERE cod_agent = $1 AND hub = 'waba' LIMIT 1",
            params: [cod_agent],
          },
        },
      });

      if (dbError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch agent credentials", details: String(dbError) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agent = dbResult?.data?.[0];
      if (!agent) {
        return new Response(
          JSON.stringify({ error: "Agent not found or not WABA" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      waba_token = agent.waba_token;
      phone_number_id = agent.waba_number_id;
      waba_id = agent.waba_id;
    }

    // log_outbound does NOT call Meta — it only persists. Skip credential check.
    if (action !== "log_outbound" && (!waba_token || !phone_number_id)) {
      return new Response(
        JSON.stringify({ error: "WABA credentials incomplete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route by action
    switch (action) {
      case "log_outbound": {
        const { to, type, text, caption, media_url, file_name, meta_message_id, reply_to } = params;
        if (!to || !type || !meta_message_id) {
          return new Response(
            JSON.stringify({ error: "to, type and meta_message_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const allowedTypes = ["text", "image", "video", "audio", "document", "sticker"];
        if (!allowedTypes.includes(type)) {
          return new Response(
            JSON.stringify({ error: `Invalid type. Allowed: ${allowedTypes.join(", ")}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!resolved_queue_id) {
          return new Response(
            JSON.stringify({ error: "Could not resolve queue_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanNumber = String(to).replace(/\D/g, "");

        // Dedupe by external_id
        const { data: existing } = await supabase
          .from("chat_messages")
          .select("id, conversation_id, contact_id")
          .eq("external_id", meta_message_id)
          .maybeSingle();

        if (existing?.id) {
          console.log(`[waba-send] log_outbound deduped meta_id=${meta_message_id}`);
          return new Response(
            JSON.stringify({ ok: true, deduped: true, message_id: existing.id, conversation_id: existing.conversation_id, contact_id: existing.contact_id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await persistOutbound({
          queueId: resolved_queue_id,
          toPhone: cleanNumber,
          metaMessageId: meta_message_id,
          type,
          text: text ?? null,
          caption: caption ?? null,
          mediaUrl: media_url ?? null,
          fileName: file_name ?? null,
          senderName: sender_name,
          source: source || "log_outbound",
          replyTo: reply_to ?? null,
        });

        return new Response(
          JSON.stringify({ ok: true, deduped: false, meta_message_id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send_text": {
        const { to, text } = params;
        if (!to || !text) {
          return new Response(
            JSON.stringify({ error: "to and text are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanNumber = to.replace(/\D/g, "");
        const resp = await fetchWithRetry(`${GRAPH_API}/${phone_number_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waba_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanNumber,
            type: "text",
            text: { body: text },
          }),
        });

        const data = await resp.json();
        if (!resp.ok) {
          console.error(`[waba-send] send_text failed: status=${resp.status}, to=${cleanNumber}, response=${JSON.stringify(data)}`);
        } else {
          console.log(`[waba-send] send_text ok: to=${cleanNumber}, message_id=${data?.messages?.[0]?.id}`);
          await persistOutbound({
            queueId: queue_id ?? null,
            toPhone: cleanNumber,
            metaMessageId: data?.messages?.[0]?.id,
            type: "text",
            text,
            senderName: sender_name,
            source,
          });
        }
        return new Response(JSON.stringify(data), {
          status: resp.ok ? 200 : resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_media": {
        const to = params.to;
        const rawMediaType = params.media_type ?? params.type;
        const base64 = params.base64 ?? params.mediaBase64;
        const mimetype = params.mimetype;
        const filename = params.filename ?? params.fileName;
        const caption = params.caption;
        if (!to || !base64 || !mimetype || !rawMediaType) {
          return new Response(
            JSON.stringify({ error: "to, media_type, base64, and mimetype are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Map ptt → audio (WhatsApp recognizes voice notes by ogg/opus container)
        const media_type = rawMediaType === "ptt" ? "audio" : rawMediaType;

        // For audio voice notes, Meta REQUIRES "audio/ogg; codecs=opus" (with codecs).
        // For other media types, Meta rejects parameters in MIME — use base type only.
        const rawMime = String(mimetype).trim();
        const baseMime = rawMime.split(";")[0].trim();
        const isAudio = media_type === "audio";
        // Meta Graph API supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (codecs=opus only)
        const uploadMime = isAudio
          ? (baseMime === "audio/ogg" ? "audio/ogg; codecs=opus" : baseMime)
          : baseMime;
        const fallbackName = filename || (isAudio ? `voice_${Date.now()}.ogg` : "file");

        const cleanNumber = to.replace(/\D/g, "");

        // Step 1: Upload media to Meta
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const formData = new FormData();
        const blob = new Blob([bytes], { type: uploadMime });
        formData.append("file", blob, fallbackName);
        formData.append("messaging_product", "whatsapp");
        formData.append("type", uploadMime);

        console.log(`[waba-send] Uploading media: type=${media_type}, mime=${uploadMime}, size=${bytes.length}, filename=${fallbackName}`);

        const uploadResp = await fetchWithRetry(`${GRAPH_API}/${phone_number_id}/media`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waba_token}`,
          },
          body: formData,
        });

        const uploadData = await uploadResp.json();

        if (!uploadResp.ok || !uploadData.id) {
          console.error(`[waba-send] Upload failed: status=${uploadResp.status}, mime=${uploadMime}, response=${JSON.stringify(uploadData)}`);
          return new Response(
            JSON.stringify({ error: "Failed to upload media", details: uploadData }),
            { status: uploadResp.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const mediaId = uploadData.id;

        // Step 2: Send message with media_id
        // Map media_type to WhatsApp API type
        const waType = media_type === "audio" ? "audio"
          : media_type === "video" ? "video"
          : media_type === "document" ? "document"
          : media_type === "sticker" ? "sticker"
          : "image";

        const mediaPayload: any = { id: mediaId };
        if (caption && waType !== "audio" && waType !== "sticker") {
          mediaPayload.caption = caption;
        }
        if (waType === "document" && filename) {
          mediaPayload.filename = filename;
        }

        const msgResp = await fetchWithRetry(`${GRAPH_API}/${phone_number_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waba_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanNumber,
            type: waType,
            [waType]: mediaPayload,
          }),
        });

        const msgData = await msgResp.json();
        if (msgResp.ok) {
          await persistOutbound({
            queueId: queue_id ?? null,
            toPhone: cleanNumber,
            metaMessageId: msgData?.messages?.[0]?.id,
            type: waType as any,
            caption: caption ?? null,
            fileName: filename ?? null,
            senderName: sender_name,
            source,
          });
        }
        return new Response(JSON.stringify(msgData), {
          status: msgResp.ok ? 200 : msgResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "download_media": {
        const { media_id } = params;
        if (!media_id) {
          return new Response(
            JSON.stringify({ error: "media_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 1: Get media URL
        const mediaInfoResp = await fetchWithRetry(`${GRAPH_API}/${media_id}`, {
          headers: { Authorization: `Bearer ${waba_token}` },
        });
        const mediaInfo = await mediaInfoResp.json();

        if (!mediaInfo.url) {
          return new Response(
            JSON.stringify({ error: "Could not get media URL", details: mediaInfo }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 2: Download the actual media
        const mediaResp = await fetch(mediaInfo.url, {
          headers: { Authorization: `Bearer ${waba_token}` },
        });

        if (!mediaResp.ok) {
          const errText = await mediaResp.text();
          return new Response(
            JSON.stringify({ error: "Failed to download media", details: errText }),
            { status: mediaResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const mediaBuffer = await mediaResp.arrayBuffer();
        const base64Out = btoa(
          new Uint8Array(mediaBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        return new Response(
          JSON.stringify({
            base64: base64Out,
            mimetype: mediaInfo.mime_type || mediaResp.headers.get("content-type"),
            file_size: mediaInfo.file_size,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "mark_read": {
        const { message_id } = params;
        if (!message_id) {
          return new Response(
            JSON.stringify({ ok: false, error: "message_id is required" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        try {
          const resp = await fetchWithRetry(`${GRAPH_API}/${phone_number_id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waba_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              status: "read",
              message_id,
            }),
          });
          const data = await resp.json().catch(() => ({}));
          return new Response(JSON.stringify({ ok: resp.ok, data }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          // best-effort, never block
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
  } catch (error) {
    console.error("waba-send error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
