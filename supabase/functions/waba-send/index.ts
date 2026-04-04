import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, cod_agent, ...params } = await req.json();

    if (!action || !cod_agent) {
      return new Response(
        JSON.stringify({ error: "action and cod_agent are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch WABA credentials from external DB
    const externalDbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
    const externalDbCa = Deno.env.get("EXTERNAL_DB_CA_CERT");

    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    
    const poolConfig: any = {
      connectionString: externalDbUrl,
      size: 1,
    };

    if (externalDbCa) {
      poolConfig.tls = {
        enabled: true,
        caCertificates: [externalDbCa],
      };
    }

    const pool = new Pool(poolConfig, 1);
    const conn = await pool.connect();

    let waba_token: string;
    let phone_number_id: string;
    let waba_id: string;

    try {
      const result = await conn.queryObject<{
        waba_token: string;
        waba_number_id: string;
        waba_id: string;
      }>(
        "SELECT waba_token, waba_number_id, waba_id FROM agents WHERE cod_agent = $1 AND hub = 'waba' LIMIT 1",
        [cod_agent]
      );

      if (!result.rows.length) {
        return new Response(
          JSON.stringify({ error: "Agent not found or not WABA" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agent = result.rows[0];
      waba_token = agent.waba_token;
      phone_number_id = agent.waba_number_id;
      waba_id = agent.waba_id;
    } finally {
      conn.release();
      await pool.end();
    }

    if (!waba_token || !phone_number_id) {
      return new Response(
        JSON.stringify({ error: "WABA credentials incomplete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route by action
    switch (action) {
      case "send_text": {
        const { to, text } = params;
        if (!to || !text) {
          return new Response(
            JSON.stringify({ error: "to and text are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanNumber = to.replace(/\D/g, "");
        const resp = await fetch(`${GRAPH_API}/${phone_number_id}/messages`, {
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
        return new Response(JSON.stringify(data), {
          status: resp.ok ? 200 : resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_media": {
        const { to, media_type, base64, mimetype, filename, caption } = params;
        if (!to || !base64 || !mimetype || !media_type) {
          return new Response(
            JSON.stringify({ error: "to, media_type, base64, and mimetype are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanNumber = to.replace(/\D/g, "");

        // Step 1: Upload media to Meta
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const formData = new FormData();
        const blob = new Blob([bytes], { type: mimetype });
        formData.append("file", blob, filename || "file");
        formData.append("messaging_product", "whatsapp");
        formData.append("type", mimetype);

        const uploadResp = await fetch(`${GRAPH_API}/${phone_number_id}/media`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waba_token}`,
          },
          body: formData,
        });

        const uploadData = await uploadResp.json();

        if (!uploadResp.ok || !uploadData.id) {
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

        const msgResp = await fetch(`${GRAPH_API}/${phone_number_id}/messages`, {
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
        const mediaInfoResp = await fetch(`${GRAPH_API}/${media_id}`, {
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

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("waba-send error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
