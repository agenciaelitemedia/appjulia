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
    
    console.log("[support-webhook] EventType:", body?.EventType, "Instance:", instance);

    // UaZapi format: body.message.chatid contains the JID
    const msg = body?.message;
    const chat = body?.chat;
    
    if (!msg) {
      return new Response(JSON.stringify({ ok: true, skipped: "no message data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = msg?.chatid || chat?.wa_chatid || "";

    // Only process group messages
    if (!remoteJid.includes("@g.us") && !msg?.isGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Extract fields from UaZapi format
    // content can be a string (text) or object (media with URL, etc.)
    const rawContent = msg?.content;
    const contentText = typeof rawContent === "string" ? rawContent : (rawContent?.caption || msg?.text || "");
    const mediaType = (msg?.mediaType || msg?.messageType || "").toLowerCase();
    const isFromMe = msg?.fromMe || false;
    const messageId = msg?.id || msg?.messageid || "";
    const groupName = msg?.groupName || chat?.wa_name || chat?.name || null;
    
    // Sender: use sender_pn (PhoneNumber) field for real phone
    const senderLid = msg?.sender || msg?.sender_lid || chat?.wa_lastMessageSender || "";
    const senderPn = msg?.sender_pn || "";
    const senderPhone = senderPn ? senderPn.split("@")[0] : "";
    
    // Determine message type
    let messageType = "text";
    if (mediaType.includes("image")) messageType = "image";
    else if (mediaType.includes("video")) messageType = "video";
    else if (mediaType.includes("audio") || mediaType === "ptt") messageType = "audio";
    else if (mediaType.includes("document")) messageType = "document";
    else if (mediaType.includes("sticker")) messageType = "sticker";
    else if (!mediaType || mediaType === "conversation") messageType = "text";

    // Media URL: in UaZapi, it's inside content.URL for media messages
    const mediaUrl = (typeof rawContent === "object" ? rawContent?.URL : null)
      || msg?.mediaUrl || msg?.media_url || null;

    // Determine sender role by matching with support_team_members
    let senderRole = "cliente";
    let senderDisplayName = msg?.senderName || chat?.wa_contactName || "";
    
    const { data: teamMembers } = await supabase
      .from("support_team_members")
      .select("phone, name");

    if (teamMembers && senderPhone) {
      const cleanPhone = senderPhone.replace(/\D/g, "");
      const match = teamMembers.find((tm: any) =>
        tm.phone && (cleanPhone.includes(tm.phone) || tm.phone.includes(cleanPhone))
      );
      if (match) {
        senderRole = "suporte";
        senderDisplayName = match.name || senderDisplayName;
      }
    }

    // If isFromMe, it's from the connected account (support)
    if (isFromMe) {
      senderRole = "suporte";
    }

    // Build descriptive message_text for media
    const roleLabel = senderRole === "suporte" ? `suporte ${senderDisplayName}` : "cliente";
    let messageText = content || null;

    if (messageType === "image") {
      messageText = content || `📷 Imagem enviada pelo ${roleLabel}`;
    } else if (messageType === "video") {
      messageText = content || `🎬 Vídeo enviado pelo ${roleLabel}`;
    } else if (messageType === "document") {
      messageText = content || `📄 Documento enviado pelo ${roleLabel}`;
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
      sender_jid: senderLid || senderPhone,
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

    console.log("[support-webhook] SAVED:", remoteJid, "role:", senderRole, "type:", messageType);
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
