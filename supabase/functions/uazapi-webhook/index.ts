import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const N8N_BASE_URL = Deno.env.get("UAZAPI_WEBHOOK_URL") ||
  "https://webhook.atendejulia.com.br/webhook/julia_MQv8.2_start";

// ─── DB pool for external database ────────────────────────
async function getExternalPool() {
  const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const externalDbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
  const externalDbCa = Deno.env.get("EXTERNAL_DB_CA_CERT");
  const poolConfig: any = {
    connectionString: externalDbUrl,
    size: 1,
  };
  const isSocket = externalDbUrl.includes('/.s.PGSQL.') || externalDbUrl.includes('%2F');
  if (externalDbCa && !isSocket) {
    poolConfig.tls = { enabled: true, caCertificates: [externalDbCa] };
  }
  return new Pool(poolConfig, 1);
}

// ─── Resolve agent from instance name ─────────────────────
async function resolveAgentByInstance(
  instance: string,
): Promise<
  { cod_agent: string; client_id: string; evo_url: string } | null
> {
  let pool: any;
  try {
    pool = await getExternalPool();
    const conn = await pool.connect();
    try {
      const result = await conn.queryObject<
        { cod_agent: string; client_id: string; evo_url: string }
      >(
        "SELECT cod_agent, COALESCE(client_id::text, cod_agent) as client_id, evo_url FROM agents WHERE evo_instancia = $1 AND hub = 'uazapi' LIMIT 1",
        [instance],
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("resolveAgentByInstance error:", err);
    return null;
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

// ─── Resolve agent from cod_agent ─────────────────────────
async function resolveAgentByCodAgent(
  codAgent: string,
): Promise<{ cod_agent: string; client_id: string } | null> {
  let pool: any;
  try {
    pool = await getExternalPool();
    const conn = await pool.connect();
    try {
      const result = await conn.queryObject<
        { cod_agent: string; client_id: string }
      >(
        "SELECT cod_agent, COALESCE(client_id::text, cod_agent) as client_id FROM agents WHERE cod_agent = $1 LIMIT 1",
        [codAgent],
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("resolveAgentByCodAgent error:", err);
    return null;
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

// ─── Parse Baileys/UaZapi message type ────────────────────
function parseMessageType(msg: any): string {
  if (msg.message?.imageMessage) return "image";
  if (msg.message?.videoMessage) return "video";
  if (msg.message?.audioMessage) {
    return msg.message.audioMessage.ptt ? "ptt" : "audio";
  }
  if (msg.message?.documentMessage) return "document";
  if (msg.message?.stickerMessage) return "sticker";
  if (msg.message?.locationMessage) return "location";
  if (msg.message?.contactMessage || msg.message?.contactsArrayMessage) {
    return "contact";
  }
  if (msg.message?.reactionMessage) return "reaction";
  if (msg.message?.protocolMessage) return "revoked";
  if (msg.messageType) {
    const t = msg.messageType.toLowerCase();
    if (t.includes("image")) return "image";
    if (t.includes("video")) return "video";
    if (t.includes("audio") || t.includes("ptt")) return "audio";
    if (t.includes("document")) return "document";
    if (t.includes("sticker")) return "sticker";
    if (t.includes("location")) return "location";
    if (t.includes("contact")) return "contact";
    if (t.includes("reaction")) return "reaction";
  }
  return "text";
}

// ─── Extract text ─────────────────────────────────────────
function extractText(msg: any): string | null {
  if (msg.text) return msg.text;
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) {
    return msg.message.extendedTextMessage.text;
  }
  if (msg.message?.imageMessage?.caption) {
    return msg.message.imageMessage.caption;
  }
  if (msg.message?.videoMessage?.caption) {
    return msg.message.videoMessage.caption;
  }
  return null;
}

// ─── Extract media URL ────────────────────────────────────
function extractMediaUrl(msg: any): string | null {
  if (msg.fileURL) return msg.fileURL;
  if (msg.message?.imageMessage?.url) return msg.message.imageMessage.url;
  if (msg.message?.videoMessage?.url) return msg.message.videoMessage.url;
  if (msg.message?.audioMessage?.url) return msg.message.audioMessage.url;
  if (msg.message?.documentMessage?.url) {
    return msg.message.documentMessage.url;
  }
  if (msg.message?.stickerMessage?.url) return msg.message.stickerMessage.url;
  return null;
}

// ─── Extract remote JID phone ─────────────────────────────
function extractPhone(msg: any): string {
  const jid = msg.key?.remoteJid || msg.remoteJid || "";
  return jid.replace(/@.*/, "").replace(/\D/g, "");
}

// ─── Build metadata ──────────────────────────────────────
function buildMetadata(msg: any): any {
  const metadata: any = {};
  if (msg.message?.audioMessage) {
    metadata.is_ptt = msg.message.audioMessage.ptt;
    metadata.duration = msg.message.audioMessage.seconds;
    metadata.mimetype = msg.message.audioMessage.mimetype;
  }
  if (msg.message?.imageMessage) {
    metadata.mimetype = msg.message.imageMessage.mimetype;
    metadata.thumbnail = msg.message.imageMessage.jpegThumbnail;
  }
  if (msg.message?.videoMessage) {
    metadata.mimetype = msg.message.videoMessage.mimetype;
    metadata.duration = msg.message.videoMessage.seconds;
    metadata.thumbnail = msg.message.videoMessage.jpegThumbnail;
  }
  if (msg.message?.documentMessage) {
    metadata.mimetype = msg.message.documentMessage.mimetype;
    metadata.file_name = msg.message.documentMessage.fileName;
  }
  if (msg.message?.locationMessage) {
    metadata.latitude = msg.message.locationMessage.degreesLatitude;
    metadata.longitude = msg.message.locationMessage.degreesLongitude;
    metadata.location_name = msg.message.locationMessage.name;
    metadata.location_address = msg.message.locationMessage.address;
  }
  if (msg.message?.contactMessage) {
    metadata.contact_name = msg.message.contactMessage.displayName;
  }
  if (msg.message?.reactionMessage) {
    metadata.reaction_emoji = msg.message.reactionMessage.text;
    metadata.reaction_target_id = msg.message.reactionMessage.key?.id;
  }
  if (msg.participant || msg.pushName) {
    metadata.sender_id = msg.participant;
    metadata.sender_name = msg.pushName;
  }
  if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    metadata.quoted_message = {
      id: msg.message.extendedTextMessage.contextInfo.stanzaId,
      from_me: false,
      sender_name: msg.message.extendedTextMessage.contextInfo.participant,
    };
  }
  return metadata;
}

// ─── Main handler ─────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const instance = url.searchParams.get("instance");
    const codAgentParam = url.searchParams.get("c") ||
      url.searchParams.get("cod_agent");

    const body = await req.json();

    // Resolve agent
    let agent: { cod_agent: string; client_id: string } | null = null;

    if (instance) {
      agent = await resolveAgentByInstance(instance);
    } else if (codAgentParam) {
      agent = await resolveAgentByCodAgent(codAgentParam);
    }

    if (!agent) {
      console.error(
        "uazapi-webhook: could not resolve agent. instance:",
        instance,
        "cod_agent:",
        codAgentParam,
      );
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Determine if this is a message or status update
    const isMessage = body.key?.remoteJid || body.remoteJid || body.message;
    const isStatus = body.status && !isMessage;

    if (isMessage) {
      const phone = extractPhone(body);
      const fromMe = body.key?.fromMe ?? body.fromMe ?? false;
      const msgId = body.key?.id || body.messageId || body.id;
      const isGroup = (body.key?.remoteJid || "").includes("@g.us");
      const contactName = body.pushName || body.wa_name || phone;
      const text = extractText(body);
      const msgType = parseMessageType(body);
      const mediaUrl = extractMediaUrl(body);
      const metadata = buildMetadata(body);
      const timestamp = body.messageTimestamp || body.timestamp;

      // UPSERT chat_contact
      const { data: contactData } = await supabase
        .from("chat_contacts")
        .upsert(
          {
            client_id: agent.client_id,
            cod_agent: agent.cod_agent,
            phone,
            name: contactName,
            channel_type: "whatsapp_uazapi",
            channel_source: instance || agent.cod_agent,
            is_group: isGroup,
            remote_jid: body.key?.remoteJid || null,
            last_message_at: new Date().toISOString(),
            last_message_text: text || msgType,
            ...(!fromMe ? { unread_count: 1 } : {}),
          } as any,
          {
            onConflict: "client_id,channel_source,phone",
            ignoreDuplicates: false,
          },
        )
        .select("id")
        .single();

      let contactId = contactData?.id;

      // Fallback: find existing
      if (!contactId) {
        const { data: existing } = await supabase
          .from("chat_contacts")
          .select("id")
          .eq("client_id", agent.client_id)
          .eq("phone", phone)
          .limit(1)
          .single();

        contactId = existing?.id;

        if (contactId) {
          await supabase
            .from("chat_contacts")
            .update({
              last_message_at: new Date().toISOString(),
              last_message_text: text || msgType,
              channel_type: "whatsapp_uazapi",
              channel_source: instance || agent.cod_agent,
            })
            .eq("id", contactId);
        }
      }

      if (contactId) {
        const isoTimestamp = timestamp
          ? new Date(
            typeof timestamp === "number" ? timestamp * 1000 : timestamp,
          ).toISOString()
          : new Date().toISOString();

        await supabase.from("chat_messages").insert({
          contact_id: contactId,
          client_id: agent.client_id,
          message_id: msgId,
          external_id: msgId,
          text,
          type: msgType,
          from_me: fromMe,
          status: fromMe ? "sent" : "delivered",
          media_url: mediaUrl,
          file_name: metadata.file_name || body.message?.documentMessage?.fileName || null,
          caption: body.message?.imageMessage?.caption ||
            body.message?.videoMessage?.caption || null,
          metadata,
          timestamp: isoTimestamp,
          channel_type: "whatsapp_uazapi",
          raw_payload: body,
          is_forwarded: body.message?.extendedTextMessage?.contextInfo
            ?.isForwarded || false,
        });
      }

      // Forward to N8N (fire-and-forget)
      if (codAgentParam) {
        const n8nUrl =
          `${N8N_BASE_URL}?app=uazapi&c=${codAgentParam}`;
        fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).catch((err) =>
          console.error("N8N forward error:", err)
        );
      }
    } else if (isStatus) {
      // Status update (delivery receipt)
      const statusMap: Record<string, string> = {
        DELIVERY_ACK: "delivered",
        READ: "read",
        PLAYED: "read",
        SERVER_ACK: "sent",
      };
      const mappedStatus = statusMap[body.status] || body.status?.toLowerCase();
      const msgId = body.id || body.key?.id;

      if (msgId && mappedStatus) {
        await supabase
          .from("chat_messages")
          .update({ status: mappedStatus })
          .eq("external_id", msgId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("uazapi-webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 200, // Always 200 to avoid retries
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
