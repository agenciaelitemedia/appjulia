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
    const payload = await req.json()
    console.log('[infinitypay-webhook] Received:', JSON.stringify(payload))

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let order: any = null

    // Strategy 1: Match by invoice_slug in checkout_url
    const invoiceSlug = payload.invoice_slug || payload.slug
    if (invoiceSlug) {
      console.log('[infinitypay-webhook] Trying match by invoice_slug:', invoiceSlug)
      const { data } = await supabase
        .from('julia_orders')
        .select('*')
        .ilike('checkout_url', `%${invoiceSlug}%`)
        .eq('status', 'pending')
        .limit(1)
      if (data?.length) {
        order = data[0]
        console.log('[infinitypay-webhook] Matched by invoice_slug, order:', order.id)
      }
    }

    // Strategy 2: Match by order_nsu (InfinityPay's own NSU)
    if (!order) {
      const orderNsu = payload.order_nsu || payload.nsu || payload.reference
      if (orderNsu) {
        console.log('[infinitypay-webhook] Trying match by order_nsu:', orderNsu)
        const { data } = await supabase
          .from('julia_orders')
          .select('*')
          .eq('order_nsu', orderNsu)
          .limit(1)
        if (data?.length) {
          order = data[0]
          console.log('[infinitypay-webhook] Matched by order_nsu, order:', order.id)
        }
      }
    }

    // Strategy 3: Fallback - match by amount + pending status (most recent)
    if (!order && payload.amount) {
      console.log('[infinitypay-webhook] Trying fallback match by amount:', payload.amount)
      const { data } = await supabase
        .from('julia_orders')
        .select('*')
        .eq('plan_price', payload.amount)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (data?.length) {
        order = data[0]
        console.log('[infinitypay-webhook] Matched by amount fallback, order:', order.id)
      }
    }

    if (!order) {
      console.log('[infinitypay-webhook] No order found for payload')
      return new Response(JSON.stringify({ received: true, warning: 'order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const status = payload.status === 'approved' || payload.status === 'paid' ? 'paid' : payload.status || 'paid'
    const transactionNsu = payload.transaction_nsu || payload.transaction_id || payload.id

    const updateData: any = {
      status,
      webhook_payload: payload,
      infinitypay_transaction_nsu: transactionNsu || payload.order_nsu || null,
      updated_at: new Date().toISOString(),
    }

    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString()
      updateData.paid_amount = payload.amount || payload.paid_amount || order.plan_price
    }

    if (payload.receipt_url) {
      updateData.receipt_url = payload.receipt_url
    }

    if (payload.installments) {
      updateData.installments = payload.installments
    }

    const { error: updateError } = await supabase
      .from('julia_orders')
      .update(updateData)
      .eq('id', order.id)

    if (updateError) {
      console.error('[infinitypay-webhook] Update error:', updateError)
    } else {
      console.log('[infinitypay-webhook] Order updated:', order.id, 'status:', status)
    }

    return new Response(JSON.stringify({ received: true, order_id: order.id, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[infinitypay-webhook] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
