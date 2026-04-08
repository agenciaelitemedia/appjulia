import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const instance = url.searchParams.get("instance") || "unknown";

    const body = await req.json();
    console.log("[support-webhook] Event from instance:", instance, "type:", body?.event);

    // Only process message events
    const event = body?.event;
    if (!event || !["messages.upsert", "message", "onMessage"].includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: "not a message event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message data (Baileys format)
    const msgData = body?.data || body?.message || body;
    const key = msgData?.key || {};
    const remoteJid = key?.remoteJid || msgData?.remoteJid || "";

    // Only process group messages (@g.us)
    if (!remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract fields
    const messageContent = msgData?.message || {};
    const conversation = messageContent?.conversation
      || messageContent?.extendedTextMessage?.text
      || messageContent?.imageMessage?.caption
      || messageContent?.videoMessage?.caption
      || "";

    let messageType = "text";
    if (messageContent?.imageMessage) messageType = "image";
    else if (messageContent?.videoMessage) messageType = "video";
    else if (messageContent?.audioMessage) messageType = "audio";
    else if (messageContent?.documentMessage) messageType = "document";
    else if (messageContent?.stickerMessage) messageType = "sticker";

    const mediaUrl = messageContent?.imageMessage?.url
      || messageContent?.videoMessage?.url
      || messageContent?.audioMessage?.url
      || messageContent?.documentMessage?.url
      || null;

    const senderJid = key?.participant || key?.remoteJid || "";
    const pushName = msgData?.pushName || msgData?.verifiedBizName || "";
    const messageId = key?.id || "";
    const isFromMe = key?.fromMe || false;

    // Group name from groupMetadata if available
    const groupName = msgData?.groupMetadata?.subject || body?.groupMetadata?.subject || null;

    // Save to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("support_group_messages").insert({
      instance_name: instance,
      group_jid: remoteJid,
      group_name: groupName,
      sender_jid: senderJid,
      sender_name: pushName,
      message_id: messageId,
      message_type: messageType,
      message_text: conversation || null,
      media_url: mediaUrl,
      is_from_me: isFromMe,
      raw_payload: body,
    });

    if (error) {
      console.error("[support-webhook] Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[support-webhook] Message saved from group:", remoteJid);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[support-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
