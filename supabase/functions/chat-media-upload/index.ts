import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { base64, mimetype, fileName, contactId, clientId, source } = body;

    if (!base64 || !mimetype) {
      return new Response(
        JSON.stringify({ error: "base64 and mimetype are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Build storage path: {clientId}/{contactId}/{timestamp}_{fileName}
    // Strip codec parameters (e.g. "audio/ogg;codecs=opus" → "audio/ogg").
    // Supabase Storage rejects MIME types with parameters.
    const cleanMime = String(mimetype).split(";")[0].trim();
    const mimeExt = (cleanMime.split("/")[1] || "bin").replace(/[^a-zA-Z0-9]/g, "");
    const rawName = (fileName || `media_${Date.now()}`).toString();
    // Strip path separators and unsafe chars; keep a single extension at most.
    let safeName = rawName.replace(/[\\/]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    // If filename has no extension, append one derived from mimetype.
    if (!/\.[a-zA-Z0-9]{1,8}$/.test(safeName)) {
      safeName = `${safeName}.${mimeExt}`;
    }
    const safeClient = String(clientId || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeContact = String(contactId || "general").replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const storagePath = `${safeClient}/${safeContact}/${timestamp}_${safeName}`;

    // Upload to chat-media bucket
    const { data, error } = await supabase.storage
      .from("chat-media")
      .upload(storagePath, bytes, {
        contentType: cleanMime,
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error, "path:", storagePath, "mime:", cleanMime);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${error.message}`, path: storagePath, mime: cleanMime }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({
        url: urlData.publicUrl,
        path: storagePath,
        source: source || "upload",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("chat-media-upload error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
