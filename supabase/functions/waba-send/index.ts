import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function getExternalPool() {
  const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const externalDbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
  const externalDbCa = Deno.env.get("EXTERNAL_DB_CA_CERT");
  const poolConfig: any = {
    connectionString: externalDbUrl,
    size: 1,
  };

  const isSocket =
    externalDbUrl.includes("/.s.PGSQL.") ||
    externalDbUrl.includes("%2F") ||
    externalDbUrl.includes("host=/") ||
    externalDbUrl.includes("@/") ||
    /\/cloudsql\//.test(externalDbUrl);

  if (isSocket) {
    poolConfig.tls = { enabled: false };
  } else if (externalDbCa) {
    poolConfig.tls = { enabled: true, caCertificates: [externalDbCa] };
  }
  return new Pool(poolConfig, 1);
}

async function getWabaCredentials(codAgent: string) {
  const pool = await getExternalPool();
  const conn = await pool.connect();
  try {
    const result = await conn.queryObject<{
      waba_token: string;
      waba_number_id: string;
      waba_id: string;
    }>(
      "SELECT waba_token, waba_number_id, waba_id FROM agents WHERE cod_agent = $1 AND hub = 'waba' LIMIT 1",
      [codAgent],
    );
    if (!result.rows.length) return null;
    return result.rows[0];
  } finally {
    conn.release();
    await pool.end();
  }
}

// Resolve credentials from media_id's associated agent via external_id lookup
async function resolveCredentialsFromExternalId(externalId: string, supabase: any) {
  // Find the message's contact, then the contact's cod_agent
  const { data: msg } = await supabase
    .from("chat_messages")
    .select("contact_id")
    .eq("external_id", externalId)
    .limit(1)
    .single();

  if (!msg?.contact_id) return null;

  const { data: contact } = await supabase
    .from("chat_contacts")
    .select("cod_agent")
    .eq("id", msg.contact_id)
    .limit(1)
    .single();

  if (!contact?.cod_agent) return null;

  return await getWabaCredentials(contact.cod_agent);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, cod_agent, ...params } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route by action
    switch (action) {
      case "send_text": {
        if (!cod_agent) {
          return new Response(
            JSON.stringify({ error: "cod_agent is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const creds = await getWabaCredentials(cod_agent);
        if (!creds) {
          return new Response(
            JSON.stringify({ error: "Agent not found or not WABA" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { to, text } = params;
        if (!to || !text) {
          return new Response(
            JSON.stringify({ error: "to and text are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const cleanNumber = to.replace(/\D/g, "");
        const resp = await fetch(`${GRAPH_API}/${creds.waba_number_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${creds.waba_token}`,
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

        // If successful, save to chat_messages
        if (resp.ok && data.messages?.[0]?.id) {
          const wabaMessageId = data.messages[0].id;

          // Find the contact
          const { data: contact } = await supabase
            .from("chat_contacts")
            .select("id, client_id")
            .eq("cod_agent", cod_agent)
            .eq("phone", cleanNumber)
            .limit(1)
            .single();

          if (contact) {
            await supabase.from("chat_messages").insert({
              contact_id: contact.id,
              client_id: contact.client_id,
              external_id: wabaMessageId,
              text,
              type: "text",
              from_me: true,
              status: "sent",
              timestamp: new Date().toISOString(),
              channel_type: "whatsapp_official",
            });

            await supabase
              .from("chat_contacts")
              .update({
                last_message_at: new Date().toISOString(),
                last_message_text: text,
              })
              .eq("id", contact.id);
          }
        }

        return new Response(JSON.stringify(data), {
          status: resp.ok ? 200 : resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "download_media": {
        if (!cod_agent) {
          return new Response(
            JSON.stringify({ error: "cod_agent is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const creds = await getWabaCredentials(cod_agent);
        if (!creds) {
          return new Response(
            JSON.stringify({ error: "Agent not found or not WABA" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { media_id } = params;
        if (!media_id) {
          return new Response(
            JSON.stringify({ error: "media_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Step 1: Get media URL
        const mediaInfoResp = await fetch(`${GRAPH_API}/${media_id}`, {
          headers: { Authorization: `Bearer ${creds.waba_token}` },
        });
        const mediaInfo = await mediaInfoResp.json();

        if (!mediaInfo.url) {
          return new Response(
            JSON.stringify({ error: "Could not get media URL", details: mediaInfo }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Step 2: Download
        const mediaResp = await fetch(mediaInfo.url, {
          headers: { Authorization: `Bearer ${creds.waba_token}` },
        });

        if (!mediaResp.ok) {
          const errText = await mediaResp.text();
          return new Response(
            JSON.stringify({ error: "Failed to download media", details: errText }),
            { status: mediaResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const mediaBuffer = await mediaResp.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(mediaBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
        );

        return new Response(
          JSON.stringify({
            base64,
            mimetype: mediaInfo.mime_type || mediaResp.headers.get("content-type"),
            file_size: mediaInfo.file_size,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "download_and_store": {
        const { media_id, external_id, contact_id } = params;
        if (!media_id || !external_id) {
          return new Response(
            JSON.stringify({ error: "media_id and external_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Resolve credentials from the message's agent
        let creds: any;
        if (cod_agent) {
          creds = await getWabaCredentials(cod_agent);
        } else {
          creds = await resolveCredentialsFromExternalId(external_id, supabase);
        }

        if (!creds) {
          return new Response(
            JSON.stringify({ error: "Could not resolve WABA credentials" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Step 1: Get media URL from Graph API
        const mediaInfoResp = await fetch(`${GRAPH_API}/${media_id}`, {
          headers: { Authorization: `Bearer ${creds.waba_token}` },
        });
        const mediaInfo = await mediaInfoResp.json();

        if (!mediaInfo.url) {
          return new Response(
            JSON.stringify({ error: "Could not get media URL" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Step 2: Download the binary
        const mediaResp = await fetch(mediaInfo.url, {
          headers: { Authorization: `Bearer ${creds.waba_token}` },
        });

        if (!mediaResp.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to download media" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const mediaBuffer = await mediaResp.arrayBuffer();
        const contentType = mediaInfo.mime_type || mediaResp.headers.get("content-type") || "application/octet-stream";

        // Determine file extension
        const extMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "audio/ogg": "ogg",
          "audio/ogg; codecs=opus": "ogg",
          "audio/mpeg": "mp3",
          "audio/mp4": "m4a",
          "video/mp4": "mp4",
          "application/pdf": "pdf",
        };
        const ext = extMap[contentType.split(";")[0].trim()] || "bin";
        const filePath = `waba/${external_id}.${ext}`;

        // Step 3: Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(filePath, new Uint8Array(mediaBuffer), {
            contentType: contentType.split(";")[0].trim(),
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          return new Response(
            JSON.stringify({ error: "Upload failed", details: uploadError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Step 4: Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("chat-media")
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;

        // Step 5: Update chat_messages with media_url
        if (publicUrl) {
          await supabase
            .from("chat_messages")
            .update({ media_url: publicUrl })
            .eq("external_id", external_id);
        }

        return new Response(
          JSON.stringify({ success: true, url: publicUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (error) {
    console.error("waba-send error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
