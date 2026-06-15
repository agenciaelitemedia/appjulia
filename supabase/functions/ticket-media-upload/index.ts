import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 anos

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { base64, mimetype, fileName, ticketId, source } = body ?? {};

    if (!base64 || !mimetype) {
      return new Response(
        JSON.stringify({ error: "base64 and mimetype are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const cleanMime = String(mimetype).split(";")[0].trim();
    const ext = cleanMime.split("/")[1] || "bin";
    const safeName = (fileName || `attachment_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const rand = crypto.randomUUID().slice(0, 8);
    const storagePath = `tickets/${ticketId || "general"}/${timestamp}_${rand}_${safeName}${safeName.endsWith("." + ext) ? "" : "." + ext}`;

    const { error: upErr } = await supabase.storage
      .from("ticket-media")
      .upload(storagePath, bytes, { contentType: cleanMime, upsert: false });

    if (upErr) {
      console.error("ticket-media upload error:", upErr);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${upErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("ticket-media")
      .createSignedUrl(storagePath, SIGNED_URL_TTL);

    if (signErr || !signed?.signedUrl) {
      console.error("ticket-media sign error:", signErr);
      return new Response(
        JSON.stringify({ error: `Sign URL failed: ${signErr?.message || "unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        url: signed.signedUrl,
        path: storagePath,
        mimetype: cleanMime,
        source: source || "outgoing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ticket-media-upload error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});