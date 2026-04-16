import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const WEBHOOK_URL =
  "https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/asaas-webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { api_key, is_sandbox } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "api_key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-detect environment from key prefix, fallback to is_sandbox flag
    const isProduction = api_key.startsWith("$aact_prod_");
    const isSandboxKey = api_key.startsWith("$aact_");
    const useSandbox = isProduction ? false : (is_sandbox ?? true);

    const baseUrl = useSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/api/v3";

    const headers = {
      "Content-Type": "application/json",
      access_token: api_key,
    };

    // Check existing webhooks
    const listRes = await fetch(`${baseUrl}/webhooks`, { headers });
    const listData = await listRes.json();

    const existing = listData.data?.find(
      (w: { url: string }) => w.url === WEBHOOK_URL
    );

    if (existing) {
      // Update if disabled
      if (!existing.enabled) {
        await fetch(`${baseUrl}/webhooks/${existing.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ enabled: true }),
        });
      }
      return new Response(
        JSON.stringify({ success: true, message: "Webhook already configured", webhook_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new webhook
    const createRes = await fetch(`${baseUrl}/webhooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: WEBHOOK_URL,
        email: "suporte@atendejulia.com.br",
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: null,
        sendType: "SEQUENTIALLY",
        events: [
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
          "PAYMENT_OVERDUE",
          "PAYMENT_REFUNDED",
        ],
      }),
    });
    const createData = await createRes.json();

    if (createData.errors) {
      return new Response(
        JSON.stringify({ error: "Failed to create webhook", details: createData.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook registered", webhook_id: createData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("asaas-configure-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
