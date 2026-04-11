import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { client_id } = await req.json();
    if (!client_id) throw new Error("client_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!UAZAPI_BASE_URL || !UAZAPI_ADMIN_TOKEN) {
      throw new Error("Missing UAZAPI_BASE_URL or UAZAPI_ADMIN_TOKEN secrets");
    }

    // Check if provider already exists
    const { data: existing } = await supabase
      .from("queue_providers")
      .select("id")
      .eq("client_id", client_id)
      .eq("provider_type", "uazapi")
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      const { error } = await supabase
        .from("queue_providers")
        .update({
          evo_url: UAZAPI_BASE_URL,
          evo_apikey: UAZAPI_ADMIN_TOKEN,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, action: "updated", id: existing[0].id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new
    const { data: created, error } = await supabase
      .from("queue_providers")
      .insert({
        client_id,
        provider_type: "uazapi",
        name: "UaZapi Principal",
        evo_url: UAZAPI_BASE_URL,
        evo_apikey: UAZAPI_ADMIN_TOKEN,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, action: "created", id: created.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
