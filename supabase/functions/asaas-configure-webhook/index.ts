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

    console.log("Asaas env:", { isProduction, useSandbox, baseUrl });

    const postHeaders = { "Content-Type": "application/json", access_token: api_key };

    // Try to create webhook directly
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

    // If webhook already exists with same URL, treat as success
    if (!createRes.ok) {
      const isDuplicate = createData.errors?.some(
        (e: any) => e.code === "invalid_value" || e.description?.includes("já existe") || e.description?.includes("already")
      );
      if (isDuplicate) {
        return new Response(
          JSON.stringify({ success: true, message: "Webhook already configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
