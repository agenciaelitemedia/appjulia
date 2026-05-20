// Returns consolidated automation flags (AUTO_TRANSCRIBE_AUDIO,
// AUTO_SUMMARY_ON_RESOLVE, AUTO_SUMMARY_ON_CLOSE, USING_AUDIO) for a given
// client_id by OR-ing the `settings` of all agents under that client.
import { fetchClientAutomationFlags } from "../_shared/agentSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let clientId: string | number | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      clientId = url.searchParams.get("client_id");
    } else {
      const body = await req.json().catch(() => ({}));
      clientId = body?.client_id ?? null;
    }
    if (clientId === null || clientId === undefined || clientId === "") {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const flags = await fetchClientAutomationFlags(clientId);
    return new Response(JSON.stringify(flags), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});