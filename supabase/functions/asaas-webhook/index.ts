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
    const body = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(body));

    const event = body.event;

    // Only process payment confirmations
    if (
      event !== "PAYMENT_CONFIRMED" &&
      event !== "PAYMENT_RECEIVED"
    ) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = body.payment;
    if (!payment?.externalReference) {
      return new Response(
        JSON.stringify({ error: "No externalReference in payment" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orderId = payment.externalReference;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const paidAmount = payment.value
      ? Math.round(payment.value * 100)
      : null;
    const netAmount = payment.netValue
      ? Math.round(payment.netValue * 100)
      : null;
    const feeAmount =
      paidAmount && netAmount ? paidAmount - netAmount : null;

    const { error: updateErr } = await supabase
      .from("julia_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount: paidAmount,
        net_amount: netAmount,
        fee_amount: feeAmount,
        installments: payment.installmentCount || 1,
        webhook_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to update order:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Order ${orderId} marked as paid via Asaas webhook`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("asaas-webhook error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
