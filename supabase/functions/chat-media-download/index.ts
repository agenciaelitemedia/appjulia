// ============================================
// Chat Media Download
// Decrypts UaZapi media via POST /message/download,
// uploads to chat-media bucket, persists media_url.
// Idempotent: returns existing URL if already persisted.
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
  // Already in our bucket?
  if (url.includes("/storage/v1/object/public/chat-media/")) return true;
  // Looks like an encrypted WhatsApp media URL?
  if (url.includes(".enc")) return false;
  // Other http(s) URLs we trust as already-decrypted (rare)
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

    // Load message
    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, message_id, contact_id, client_id, media_url, type, raw_payload, file_name, metadata")
      .or(`id.eq.${messageId},message_id.eq.${messageId}`)
      .limit(1)
      .maybeSingle();

    if (msgErr || !msg) {
      return respond({ error: "Message not found", details: msgErr?.message }, 404);
    }

    // Idempotent shortcut
    if (isPersistedUrl(msg.media_url)) {
      return respond({ url: msg.media_url, cached: true });
    }

    // Resolve queue credentials
    let queue: any = null;
    if (queueId) {
      const { data } = await supabase
        .from("queues")
        .select("id, evo_url, evo_apikey")
        .eq("id", queueId)
        .maybeSingle();
      queue = data;
    }
    if (!queue) {
      // Fallback: any active queue for this client
      const { data } = await supabase
        .from("queues")
        .select("id, evo_url, evo_apikey")
        .eq("client_id", msg.client_id)
        .eq("channel_type", "whatsapp_uazapi")
        .limit(1)
        .maybeSingle();
      queue = data;
    }

    if (!queue?.evo_url || !queue?.evo_apikey) {
      return respond({ error: "Queue credentials not found" }, 400);
    }

    const baseUrl = String(queue.evo_url).replace(/\/+$/, "");
    const externalId = msg.message_id || messageId;

    // Call UaZapi /message/download with return_link
    const dlRes = await fetch(`${baseUrl}/message/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: queue.evo_apikey,
      },
      body: JSON.stringify({
        id: externalId,
        return_link: true,
      }),
    });

    if (!dlRes.ok) {
      const txt = await dlRes.text();
      console.error("[chat-media-download] UaZapi error:", dlRes.status, txt);
      return respond({ error: `UaZapi download failed: ${dlRes.status}`, details: txt }, 502);
    }

    const dlData = await dlRes.json();
    const fileURL: string | undefined = dlData.fileURL || dlData.url || dlData.link;
    const base64: string | undefined = dlData.base64 || dlData.fileBase64;
    const mimetype: string = dlData.mimetype || dlData.mime || msg.metadata?.mimetype || "application/octet-stream";

    let bytes: Uint8Array | null = null;
    if (base64) {
      const bin = atob(base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (fileURL) {
      const fileRes = await fetch(fileURL);
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

    return respond({ url: publicUrl, cached: false });
  } catch (err) {
    console.error("[chat-media-download] Error:", err);
    return respond({ error: (err as Error).message }, 500);
  }
});
