// ============================================
// Chat Media Download
// Supports both UaZapi (decrypts via /message/download) and WABA (Graph API).
// Uploads to chat-media bucket and persists media_url. Idempotent.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPersistedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes("/storage/v1/object/public/chat-media/")) return true;
  if (url.startsWith("waba_media:")) return false;
  if (url.includes(".enc")) return false;
  return /^https?:\/\//.test(url) && !url.includes("mmg.whatsapp.net");
}

function extFromMime(mime?: string, fallback = "bin"): string {
  if (!mime) return fallback;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "application/pdf": "pdf",
  };
  const clean = mime.split(";")[0].trim().toLowerCase();
  return map[clean] || map[mime.toLowerCase()] || fallback;
}

function isWabaMessage(msg: any): boolean {
  if (!msg) return false;
  if (msg.channel_type === "whatsapp_waba" || msg.channel_type === "waba") return true;
  if (typeof msg.media_url === "string" && msg.media_url.startsWith("waba_media:")) return true;
  return false;
}

function extractWabaMediaId(msg: any): string | null {
  if (typeof msg?.media_url === "string" && msg.media_url.startsWith("waba_media:")) {
    return msg.media_url.replace("waba_media:", "").trim() || null;
  }
  const raw = msg?.raw_payload || {};
  for (const k of ["image", "audio", "video", "document", "sticker", "voice"]) {
    if (raw?.[k]?.id) return String(raw[k].id);
  }
  if (raw?.media?.id) return String(raw.media.id);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { messageId, queueId } = body || {};
    if (!messageId) return respond({ error: "messageId required" }, 400);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(messageId));
    const query = supabase
      .from("chat_messages")
      .select("id, message_id, contact_id, conversation_id, client_id, media_url, type, channel_type, raw_payload, file_name, metadata")
      .limit(1);
    const { data: msg, error: msgErr } = await (isUuid
      ? query.eq("id", messageId).maybeSingle()
      : query.eq("message_id", messageId).maybeSingle());

    if (msgErr || !msg) {
      return respond({ error: "Message not found", details: msgErr?.message }, 404);
    }

    if (isPersistedUrl(msg.media_url)) {
      return respond({ url: msg.media_url, cached: true });
    }

    // ─── Resolve queue ───────────────────────────────────────────
    let queue: any = null;
    if (queueId) {
      const { data } = await supabase
        .from("queues")
        .select("id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id, client_id")
        .eq("id", queueId)
        .maybeSingle();
      queue = data;
    }

    // Try resolving from conversation
    if (!queue && msg.conversation_id) {
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("queue_id")
        .eq("id", msg.conversation_id)
        .maybeSingle();
      if (conv?.queue_id) {
        const { data } = await supabase
          .from("queues")
          .select("id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id, client_id")
          .eq("id", conv.queue_id)
          .maybeSingle();
        queue = data;
      }
    }

    const wabaMode = isWabaMessage(msg) || queue?.channel_type === "whatsapp_waba" || queue?.channel_type === "waba";

    // ============================================
    // WABA branch
    // ============================================
    if (wabaMode) {
      // If media_url is already a usable http(s) URL (not a waba_media:<id> placeholder),
      // there is nothing to download — return it as-is. This covers outbound messages
      // logged via log_outbound and any media already persisted by the sender.
      if (
        typeof msg.media_url === "string" &&
        /^https?:\/\//i.test(msg.media_url) &&
        !msg.media_url.startsWith("waba_media:")
      ) {
        return respond({ url: msg.media_url, cached: true, channel: "waba" });
      }

      // Fallback: any WABA queue with credentials for this client
      if (!queue?.waba_token || !queue?.waba_number_id) {
        const { data } = await supabase
          .from("queues")
          .select("id, channel_type, waba_token, waba_number_id, client_id")
          .eq("client_id", msg.client_id)
          .in("channel_type", ["whatsapp_waba", "waba"])
          .not("waba_token", "is", null)
          .not("waba_number_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (data) queue = data;
      }

      if (!queue?.waba_token || !queue?.waba_number_id) {
        return respond({ error: "WABA queue credentials not found" }, 400);
      }

      const mediaId = extractWabaMediaId(msg);
      if (!mediaId) {
        // No downloadable media on this message (e.g. text-only or log_outbound
        // without media). Return existing media_url (may be null) without erroring
        // so the client UI doesn't blow up.
        return respond({ url: msg.media_url ?? null, cached: true, channel: "waba", noMedia: true });
      }

      // Call waba-send action download_media (returns base64 + mimetype)
      const { data: dlData, error: dlErr } = await supabase.functions.invoke("waba-send", {
        body: {
          action: "download_media",
          queue_id: queue.id,
          media_id: mediaId,
        },
      });

      if (dlErr || !dlData?.base64) {
        console.error("[chat-media-download] WABA download error:", dlErr, dlData);
        return respond({ error: "WABA download failed", details: dlErr?.message || dlData?.error }, 502);
      }

      const mimetype: string = dlData.mimetype || msg.metadata?.mimetype || "application/octet-stream";
      const bin = atob(dlData.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const ext = extFromMime(mimetype, msg.file_name?.split(".").pop() || "bin");
      const safeName = (msg.file_name || `${msg.id}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${msg.client_id}/${msg.contact_id}/${msg.id}_${safeName}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, bytes, { contentType: mimetype, upsert: true });

      if (upErr) {
        console.error("[chat-media-download] WABA upload error:", upErr);
        return respond({ error: `Storage upload failed: ${upErr.message}` }, 500);
      }

      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      await supabase
        .from("chat_messages")
        .update({
          media_url: publicUrl,
          metadata: { ...(msg.metadata || {}), mimetype, storage_path: path, waba_media_id: mediaId },
        })
        .eq("id", msg.id);

      return respond({ url: publicUrl, cached: false, channel: "waba" });
    }

    // ============================================
    // UaZapi branch (existing behavior)
    // ============================================
    if (!queue?.evo_url || !queue?.evo_apikey) {
      const { data } = await supabase
        .from("queues")
        .select("id, evo_url, evo_apikey, is_active")
        .eq("client_id", msg.client_id)
        .in("channel_type", ["uazapi", "whatsapp_uazapi"])
        .not("evo_url", "is", null)
        .not("evo_apikey", "is", null)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) queue = data;
    }

    if (!queue?.evo_url || !queue?.evo_apikey) {
      return respond({ error: "Queue credentials not found" }, 400);
    }

    const baseUrl = String(queue.evo_url).replace(/\/+$/, "");
    // For backfilled messages we stored a synthetic message_id (`backfill:<contact>:<id>`)
    // and preserved the real WhatsApp id under metadata.original_message_id.
    const storedMessageId: string | undefined = msg.message_id || undefined;
    let originalMessageId: string | undefined = (msg.metadata as any)?.original_message_id;
    const isBackfill = typeof storedMessageId === "string" && storedMessageId.startsWith("backfill:");
    let externalId = isBackfill && originalMessageId
      ? originalMessageId
      : (storedMessageId && !storedMessageId.startsWith("backfill:")
          ? storedMessageId
          : originalMessageId);

    // Permanent flag check: once marked unavailable, do not retry automatically
    if ((msg.metadata as any)?.media_unavailable === true) {
      return respond({
        error: "MEDIA_UNAVAILABLE",
        details: "Media previously marked as permanently unavailable",
        fallback: true,
        permanent: true,
      }, 200);
    }

    // Helper: try /message/find by chatid + timestamp to recover real id
    const tryRecoverExternalId = async (): Promise<string | undefined> => {
      const raw: any = msg.raw_payload || {};
      const chatid: string | undefined = raw.chatid || raw.chatId || raw.key?.remoteJid || raw.remoteJid;
      const ts = raw.messageTimestamp ?? raw.timestamp;
      if (!chatid) return undefined;
      try {
        const findRes = await fetch(`${baseUrl}/message/find`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: queue.evo_apikey },
          body: JSON.stringify({ chatid, limit: 50, offset: 0 }),
          signal: AbortSignal.timeout(20000),
        });
        if (!findRes.ok) return undefined;
        const findText = await findRes.text();
        let data: any;
        try {
          data = JSON.parse(findText);
        } catch {
          console.warn("[chat-media-download] /message/find returned non-JSON:", findText.slice(0, 200));
          return undefined;
        }
        const list: any[] = Array.isArray(data) ? data
          : Array.isArray(data?.messages) ? data.messages
          : Array.isArray(data?.data) ? data.data : [];
        if (!list.length) return undefined;
        const tsNum = ts ? (typeof ts === "number" ? ts : Number(ts)) : null;
        let best: any = null;
        let bestDelta = Number.POSITIVE_INFINITY;
        for (const m of list) {
          const id = m.id || m.messageId || m.key?.id;
          if (!id) continue;
          const mts = m.messageTimestamp ?? m.timestamp;
          if (tsNum && mts) {
            const mn = typeof mts === "number" ? mts : Number(mts);
            const delta = Math.abs(mn - tsNum);
            if (delta < bestDelta) { bestDelta = delta; best = m; }
          } else if (!best) {
            best = m;
          }
        }
        const recoveredId = best ? (best.id || best.messageId || best.key?.id) : undefined;
        if (recoveredId) {
          await supabase
            .from("chat_messages")
            .update({ metadata: { ...(msg.metadata || {}), original_message_id: recoveredId } })
            .eq("id", msg.id);
        }
        return recoveredId;
      } catch (e) {
        console.warn("[chat-media-download] /message/find recovery failed:", (e as Error).message);
        return undefined;
      }
    };

    if (!externalId) {
      const recovered = await tryRecoverExternalId();
      if (recovered) externalId = recovered;
    }

    if (!externalId) {
      // Mark as permanent so frontend stops retrying
      await supabase
        .from("chat_messages")
        .update({ metadata: { ...(msg.metadata || {}), media_unavailable: true } })
        .eq("id", msg.id);
      return respond({
        error: "MEDIA_UNAVAILABLE",
        details: "No external WhatsApp message id available to download media",
        fallback: true,
        permanent: true,
      }, 200);
    }

    const callDownload = async (id: string) => fetch(`${baseUrl}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: queue.evo_apikey },
      body: JSON.stringify({ id, return_link: true }),
      // Hard cap to avoid Edge Function 150s IDLE_TIMEOUT when UaZapi hangs
      signal: AbortSignal.timeout(60000),
    });

    let dlRes: Response;
    try {
      dlRes = await callDownload(externalId);

      // 404 → try to recover via /message/find once, then retry
      if (dlRes.status === 404 && !originalMessageId) {
        const recovered = await tryRecoverExternalId();
        if (recovered && recovered !== externalId) {
          externalId = recovered;
          dlRes = await callDownload(externalId);
        }
      }
    } catch (err) {
      const isAbort = (err as Error)?.name === "AbortError" || (err as Error)?.name === "TimeoutError";
      console.error("[chat-media-download] UaZapi fetch failed:", (err as Error)?.message);
      return respond({
        error: isAbort ? "UAZAPI_TIMEOUT" : "UAZAPI_FETCH_ERROR",
        details: (err as Error)?.message ?? "fetch failed",
        fallback: true,
        transient: true,
      }, 200);
    }

    if (!dlRes.ok) {
      const txt = await dlRes.text();
      console.error("[chat-media-download] UaZapi error:", dlRes.status, txt);
      // Classify: 503 / disconnected / 5xx → transient. 404 → permanent.
      const isTransient = dlRes.status === 503 || dlRes.status >= 500 || /disconnect/i.test(txt);
      const isPermanent = dlRes.status === 404 && !isTransient;
      if (isPermanent) {
        await supabase
          .from("chat_messages")
          .update({ metadata: { ...(msg.metadata || {}), media_unavailable: true } })
          .eq("id", msg.id);
      }
      return respond({
        error: dlRes.status === 404 ? "MESSAGE_NOT_FOUND" : `UAZAPI_ERROR_${dlRes.status}`,
        details: txt,
        fallback: true,
        transient: isTransient,
        permanent: isPermanent,
      }, 200);
    }

    const dlText = await dlRes.text();
    let dlData: any;
    try {
      dlData = JSON.parse(dlText);
    } catch {
      console.error("[chat-media-download] UaZapi returned non-JSON body:", dlText.slice(0, 300));
      return respond({
        error: "UAZAPI_INVALID_RESPONSE",
        details: "Provider returned non-JSON body (likely HTML error page)",
        fallback: true,
        transient: true,
      }, 200);
    }
    const fileURL: string | undefined = dlData.fileURL || dlData.url || dlData.link;
    const base64: string | undefined = dlData.base64 || dlData.fileBase64;
    const mimetype: string = dlData.mimetype || dlData.mime || msg.metadata?.mimetype || "application/octet-stream";

    let bytes: Uint8Array | null = null;
    if (base64) {
      const bin = atob(base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (fileURL) {
      const fileRes = await fetch(fileURL, { signal: AbortSignal.timeout(60000) });
      if (!fileRes.ok) {
        return respond({ error: `Failed to fetch decrypted file: ${fileRes.status}` }, 502);
      }
      bytes = new Uint8Array(await fileRes.arrayBuffer());
    } else {
      return respond({ error: "No fileURL/base64 returned by UaZapi", raw: dlData }, 502);
    }

    const ext = extFromMime(mimetype, msg.file_name?.split(".").pop() || "bin");
    const safeName = (msg.file_name || `${msg.id}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${msg.client_id}/${msg.contact_id}/${msg.id}_${safeName}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, bytes, { contentType: mimetype, upsert: true });

    if (upErr) {
      console.error("[chat-media-download] Upload error:", upErr);
      return respond({ error: `Storage upload failed: ${upErr.message}` }, 500);
    }

    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    await supabase
      .from("chat_messages")
      .update({
        media_url: publicUrl,
        metadata: { ...(msg.metadata || {}), mimetype, storage_path: path },
      })
      .eq("id", msg.id);

    return respond({ url: publicUrl, cached: false, channel: "uazapi" });
  } catch (err) {
    console.error("[chat-media-download] Error:", err);
    // Always respond with JSON 200 so the client never has to parse HTML
    return respond({
      error: (err as Error).message || "Unexpected error",
      fallback: true,
      transient: true,
    }, 200);
  }
});
