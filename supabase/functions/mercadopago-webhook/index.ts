import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    console.log('[mercadopago-webhook] Received:', JSON.stringify(body))

    let paymentId: string | null = null

    if (body.type === 'payment' && body.data?.id) {
      paymentId = String(body.data.id)
    } else if (body.action === 'payment.created' || body.action === 'payment.updated') {
      paymentId = String(body.data?.id)
    }

    if (!paymentId) {
      const url = new URL(req.url)
      const topic = url.searchParams.get('topic')
      const id = url.searchParams.get('id')
      if (topic === 'payment' && id) {
        paymentId = id
      }
    }

    if (!paymentId) {
      console.log('[mercadopago-webhook] Not a payment notification, ignoring')
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: mpConfig } = await supabase
      .from('julia_payment_config')
      .select('*')
      .eq('gateway', 'mercadopago')
      .single()

    if (!mpConfig) {
      console.error('[mercadopago-webhook] MP config not found')
      return new Response(JSON.stringify({ error: 'Config not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const config = mpConfig.config as Record<string, string>
    const accessToken = config.access_token

    const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    const paymentText = await paymentResp.text()
    console.log('[mercadopago-webhook] Payment lookup status:', paymentResp.status)

    if (!paymentResp.ok) {
      console.error('[mercadopago-webhook] Payment lookup failed:', paymentText)
      return new Response(JSON.stringify({ error: 'Payment lookup failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payment = JSON.parse(paymentText)
    const externalReference = payment.external_reference

    if (!externalReference) {
      console.log('[mercadopago-webhook] No external_reference in payment')
      return new Response(JSON.stringify({ status: 'no_reference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[mercadopago-webhook] Payment status:', payment.status, 'for order:', externalReference)

    if (payment.status === 'approved') {
      const paidAmountCents = Math.round((payment.transaction_amount || 0) * 100)

      // Extract net amount and fees from MP response
      let netAmountCents: number | null = null
      let feeAmountCents: number | null = null

      if (payment.net_received_amount != null) {
        netAmountCents = Math.round(payment.net_received_amount * 100)
      }

      if (Array.isArray(payment.fee_details) && payment.fee_details.length > 0) {
        const totalFees = payment.fee_details.reduce(
          (sum: number, fee: { amount?: number }) => sum + (fee.amount || 0),
          0
        )
        feeAmountCents = Math.round(totalFees * 100)
      }

      // If we have paid but no net, calculate from fees
      if (netAmountCents == null && feeAmountCents != null) {
        netAmountCents = paidAmountCents - feeAmountCents
      }
      // If we have net but no fees, calculate fees
      if (feeAmountCents == null && netAmountCents != null) {
        feeAmountCents = paidAmountCents - netAmountCents
      }

      const { error: updateError } = await supabase
        .from('julia_orders')
        .update({
          status: 'paid',
          paid_amount: paidAmountCents,
          net_amount: netAmountCents,
          fee_amount: feeAmountCents,
          paid_at: payment.date_approved || new Date().toISOString(),
          mp_payment_id: String(paymentId),
          installments: payment.installments || 1,
          webhook_payload: payment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', externalReference)

      if (updateError) {
        console.error('[mercadopago-webhook] Update error:', updateError)
      } else {
        console.log('[mercadopago-webhook] Order updated to paid:', externalReference, 
          'net:', netAmountCents, 'fees:', feeAmountCents)
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await supabase
        .from('julia_orders')
        .update({
          status: 'failed',
          webhook_payload: payment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', externalReference)
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[mercadopago-webhook] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
