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
    
    // Log full payload for debugging
    console.log("[support-webhook] FULL PAYLOAD:", JSON.stringify(body).substring(0, 2000));

    // Flexible event detection
    const event = body?.event || body?.data?.event || "unknown";
    console.log("[support-webhook] Event:", event, "Instance:", instance);

    // Extract message data from multiple possible paths
    let msgData: any = null;
    if (body?.data) {
      msgData = Array.isArray(body.data) ? body.data[0] : body.data;
    } else if (body?.message) {
      msgData = body;
    } else if (body?.key) {
      msgData = body;
    }

    if (!msgData) {
      console.log("[support-webhook] No message data found in payload");
      return new Response(JSON.stringify({ ok: true, skipped: "no message data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract key and remoteJid from multiple paths
    const key = msgData?.key || {};
    const remoteJid = key?.remoteJid || msgData?.remoteJid || "";

    // Only process group messages (@g.us)
    if (!remoteJid.includes("@g.us")) {
      console.log("[support-webhook] Not a group message, remoteJid:", remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if group is monitored
    const { data: monitored } = await supabase
      .from("support_monitored_groups")
      .select("group_jid")
      .eq("group_jid", remoteJid)
      .eq("is_active", true)
      .maybeSingle();

    if (!monitored) {
      console.log("[support-webhook] Group not monitored:", remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "group not monitored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message content
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

    // Extract sender info - handle LID addressing
    const participant = key?.participant || "";
    const senderJid = participant || key?.remoteJid || "";
    const pushName = msgData?.pushName || msgData?.verifiedBizName || "";
    const messageId = key?.id || "";
    const isFromMe = key?.fromMe || false;

    // Try to get PhoneNumber from participant data if available (LID mode)
    // The PhoneNumber field may be in different locations depending on the API version
    const participantPhone = msgData?.participant?.PhoneNumber 
      || msgData?.participantPhoneNumber
      || null;
    
    // Extract phone number: prefer PhoneNumber field, fallback to parsing JID
    let senderPhone = "";
    if (participantPhone) {
      senderPhone = participantPhone.split("@")[0];
    } else if (senderJid && !senderJid.includes("@lid")) {
      senderPhone = senderJid.split("@")[0];
    }

    // Group name from groupMetadata if available
    const groupName = msgData?.groupMetadata?.subject || body?.groupMetadata?.subject || null;

    // Determine sender_role by matching phone with support_team_members
    let senderRole = "cliente";
    const { data: teamMembers } = await supabase
      .from("support_team_members")
      .select("phone, name");

    let senderDisplayName = pushName;
    if (teamMembers && senderPhone) {
      const match = teamMembers.find((tm: any) =>
        tm.phone && (senderPhone.includes(tm.phone) || tm.phone.includes(senderPhone))
      );
      if (match) {
        senderRole = "suporte";
        senderDisplayName = match.name || pushName;
      }
    }

    // Build descriptive message_text for media
    const roleLabel = senderRole === "suporte" ? `suporte ${senderDisplayName}` : "cliente";
    let messageText = conversation || null;

    if (messageType === "image") {
      messageText = conversation || `📷 Imagem enviada pelo ${roleLabel}`;
    } else if (messageType === "video") {
      messageText = conversation || `🎬 Vídeo enviado pelo ${roleLabel}`;
    } else if (messageType === "document") {
      const fileName = messageContent?.documentMessage?.fileName || "";
      messageText = `📄 Documento${fileName ? ` (${fileName})` : ""} enviado pelo ${roleLabel}`;
    } else if (messageType === "audio") {
      messageText = `🎤 Áudio aguardando transcrição`;
    } else if (messageType === "sticker") {
      messageText = `🏷️ Sticker enviado pelo ${roleLabel}`;
    }

    const isTranscribed = messageType !== "audio";

    const { error } = await supabase.from("support_group_messages").insert({
      instance_name: instance,
      group_jid: remoteJid,
      group_name: groupName,
      sender_jid: senderJid,
      sender_name: senderDisplayName,
      message_id: messageId,
      message_type: messageType,
      message_text: messageText,
      media_url: mediaUrl,
      is_from_me: isFromMe,
      raw_payload: body,
      sender_role: senderRole,
      is_transcribed: isTranscribed,
      transcription: null,
    });

    if (error) {
      console.error("[support-webhook] Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[support-webhook] Message saved from group:", remoteJid, "role:", senderRole, "type:", messageType);
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
