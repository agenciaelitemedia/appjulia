import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("julia_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Asaas config
    const { data: config } = await supabase
      .from("julia_payment_config")
      .select("*")
      .eq("gateway", "asaas")
      .single();

    if (!config?.config?.api_key) {
      return new Response(JSON.stringify({ error: "Asaas not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = (config.config as Record<string, string>).api_key;
    const isProduction = apiKey.startsWith("$aact_prod_");
    const useSandbox = isProduction ? false : (config.is_sandbox ?? true);
    const baseUrl = useSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const headers = {
      "Content-Type": "application/json",
      access_token: apiKey,
    };

    // Clean CPF/CNPJ
    const cpfCnpj = order.customer_document.replace(/\D/g, "");

    // Find or create customer
    const searchRes = await fetch(
      `${baseUrl}/customers?cpfCnpj=${cpfCnpj}`,
      { headers }
    );
    const searchData = await searchRes.json();

    let customerId: string;

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: order.customer_name,
          email: order.customer_email || undefined,
          phone: order.customer_whatsapp?.replace(/\D/g, "") || undefined,
          cpfCnpj,
        }),
      });
      const createData = await createRes.json();
      if (createData.errors) {
        return new Response(
          JSON.stringify({
            error: "Failed to create Asaas customer",
            details: createData.errors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      customerId = createData.id;
    }

    const originalValue = order.plan_price / 100; // cents to BRL
    const maxInstallments = 12;
    const installmentValue = parseFloat((originalValue / maxInstallments).toFixed(2));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const paymentBody: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: originalValue,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Plano ${order.plan_name} - AtendeJulIA`,
      externalReference: order_id,
      installmentCount: maxInstallments,
      installmentValue,
    };

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify(paymentBody),
    });
    const paymentData = await paymentRes.json();

    if (paymentData.errors) {
      return new Response(
        JSON.stringify({
          error: "Failed to create payment",
          details: paymentData.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const checkoutUrl = paymentData.invoiceUrl;

    // Update order
    await supabase
      .from("julia_orders")
      .update({
        status: "pending",
        checkout_url: checkoutUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({ checkout_url: checkoutUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("asaas-checkout error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
