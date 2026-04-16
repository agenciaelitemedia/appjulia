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
      : "https://api.asaas.com/api/v3";

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

    // Calculate value with fee markup for installments
    // Asaas credit card fee: ~2.99% + R$0.49 per transaction
    // For installments, additional ~2.49% per installment after the first
    const originalValue = order.plan_price / 100; // cents to BRL
    const maxInstallments = 12;

    // Markup formula: value / (1 - fee_rate)
    // Base fee: 3.49%, installment fee: 2.49% per additional installment
    const baseFeeRate = 0.0349;
    const installmentFeeRate = 0.0249;
    const totalFeeRate = baseFeeRate + installmentFeeRate * (maxInstallments - 1);
    const valueWithMarkup = parseFloat(
      (originalValue / (1 - totalFeeRate)).toFixed(2)
    );
    const installmentValue = parseFloat(
      (valueWithMarkup / maxInstallments).toFixed(2)
    );

    // Create payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const paymentBody: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: valueWithMarkup,
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
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
