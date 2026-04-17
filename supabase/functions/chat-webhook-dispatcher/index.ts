// chat-webhook-dispatcher: envia eventos para webhooks externos com HMAC opcional
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { event, client_id, payload } = await req.json();
    if (!event || !client_id) {
      return new Response(JSON.stringify({ error: "event and client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hooks } = await supabase
      .from("chat_webhooks").select("*")
      .eq("client_id", client_id).eq("is_active", true).contains("events", [event]);

    if (!hooks || hooks.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let delivered = 0;
    await Promise.all(hooks.map(async (h: any) => {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload ?? {} });
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Lovable-Event": event };
      if (h.secret) headers["X-Lovable-Signature"] = `sha256=${await hmacSha256(h.secret, body)}`;
      try {
        const r = await fetch(h.url, { method: "POST", headers, body });
        await supabase.from("chat_webhook_deliveries").insert({
          webhook_id: h.id, event, payload: payload ?? {}, status_code: r.status, success: r.ok,
          error_message: r.ok ? null : `HTTP ${r.status}`,
        });
        if (r.ok) delivered++;
      } catch (err) {
        await supabase.from("chat_webhook_deliveries").insert({
          webhook_id: h.id, event, payload: payload ?? {}, success: false,
          error_message: err instanceof Error ? err.message : String(err),
        });
      }
    }));

    return new Response(JSON.stringify({ delivered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("dispatcher error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
