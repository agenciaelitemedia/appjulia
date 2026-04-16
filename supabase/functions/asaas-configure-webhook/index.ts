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

    // Auto-detect environment from key prefix
    const isProduction = api_key.startsWith("$aact_prod_");
    const useSandbox = isProduction ? false : (is_sandbox ?? true);

    const baseUrl = useSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/api/v3";

    console.log("Asaas env:", { isProduction, useSandbox, baseUrl, keyPrefix: api_key.substring(0, 12) });

    const getHeaders = { access_token: api_key };
    const postHeaders = { "Content-Type": "application/json", access_token: api_key };

    // Check existing webhooks
    const listRes = await fetch(`${baseUrl}/webhooks`, { headers: getHeaders });
    const listText = await listRes.text();
    console.log("Asaas list webhooks:", listRes.status, listText.substring(0, 500));

    let listData: any = { data: [] };
    try { listData = JSON.parse(listText); } catch { /* empty */ }

    if (!listRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to list webhooks", status: listRes.status, details: listData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existing = listData.data?.find(
      (w: { url: string }) => w.url === WEBHOOK_URL
    );

    if (existing) {
      if (!existing.enabled) {
        await fetch(`${baseUrl}/webhooks/${existing.id}`, {
          method: "PUT",
          headers: postHeaders,
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
      headers: postHeaders,
      body: JSON.stringify({
        name: "AtendeJulia Payments",
        url: WEBHOOK_URL,
        email: "suporte@atendejulia.com.br",
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        sendType: "SEQUENTIALLY",
        events: [
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
          "PAYMENT_OVERDUE",
          "PAYMENT_REFUNDED",
        ],
      }),
    });
    const createText = await createRes.text();
    console.log("Asaas create webhook:", createRes.status, createText.substring(0, 500));

    let createData: any = {};
    try { createData = JSON.parse(createText); } catch { /* empty */ }

    if (!createRes.ok || createData.errors) {
      return new Response(
        JSON.stringify({ error: "Failed to create webhook", details: createData.errors || createData }),
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
