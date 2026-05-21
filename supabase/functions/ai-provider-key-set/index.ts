// Securely store / report AI provider API keys (e.g. OpenRouter).
// POST { provider, api_key }  -> upserts the key (service_role only).
// GET  ?provider=openrouter   -> { configured: boolean, masked: string | null } (never the full key).
// The ai_provider_keys table has RLS enabled with no policies, so the key is
// never readable by the frontend — only this function (service_role) touches it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mask(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const provider = url.searchParams.get("provider") || "openrouter";
      const { data } = await supabase
        .from("ai_provider_keys")
        .select("api_key")
        .eq("provider", provider)
        .maybeSingle();
      const key = (data?.api_key ?? "").toString().trim();
      return json({ configured: key.length > 0, masked: key ? mask(key) : null });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const provider = (body?.provider || "openrouter").toString().trim();
      const apiKey = (body?.api_key ?? "").toString().trim();

      if (!apiKey) {
        // Empty key clears the stored key.
        await supabase.from("ai_provider_keys").delete().eq("provider", provider);
        return json({ ok: true, configured: false, masked: null });
      }

      const { error } = await supabase
        .from("ai_provider_keys")
        .upsert(
          { provider, api_key: apiKey, updated_at: new Date().toISOString() },
          { onConflict: "provider" },
        );
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true, configured: true, masked: mask(apiKey) });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
