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

    // Try to find order by NSU or transaction reference
    const orderNsu = payload.order_nsu || payload.nsu || payload.reference
    const transactionNsu = payload.transaction_nsu || payload.transaction_id || payload.id

    if (!orderNsu && !transactionNsu) {
      console.log('[infinitypay-webhook] No identifier found in payload')
      return new Response(JSON.stringify({ received: true, warning: 'no identifier' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find the order
    let query = supabase.from('julia_orders').select('*')
    if (orderNsu) {
      query = query.eq('order_nsu', orderNsu)
    }

    const { data: orders, error: fetchError } = await query.limit(1)

    if (fetchError || !orders?.length) {
      console.log('[infinitypay-webhook] Order not found for NSU:', orderNsu)
      return new Response(JSON.stringify({ received: true, warning: 'order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const order = orders[0]
    const status = payload.status === 'approved' || payload.status === 'paid' ? 'paid' : payload.status || 'paid'

    const updateData: any = {
      status,
      webhook_payload: payload,
      infinitypay_transaction_nsu: transactionNsu || null,
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
