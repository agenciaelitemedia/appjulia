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
    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the order
    const { data: order, error: fetchError } = await supabase
      .from('julia_orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!order.plan_name || !order.plan_price) {
      return new Response(JSON.stringify({ error: 'Pedido sem plano selecionado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate unique order_nsu
    const orderNsu = `JULIA-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Format phone number
    const phoneDigits = order.customer_whatsapp.replace(/\D/g, '')
    const phoneNumber = phoneDigits.startsWith('55') ? `+${phoneDigits}` : `+55${phoneDigits}`

    // Build InfinityPay payload
    const infinitypayPayload = {
      handle: 'masterchat-inova',
      items: [
        {
          quantity: 1,
          price: order.plan_price,
          description: order.plan_name,
        },
      ],
      webhook_url: `${supabaseUrl}/functions/v1/infinitypay-webhook`,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone_number: phoneNumber,
      },
    }

    console.log('[infinitypay-checkout] Sending payload:', JSON.stringify(infinitypayPayload))

    const resp = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(infinitypayPayload),
    })

    const respText = await resp.text()
    console.log('[infinitypay-checkout] Response status:', resp.status, 'body:', respText)

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `InfinityPay erro ${resp.status}: ${respText}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let respData: any
    try {
      respData = JSON.parse(respText)
    } catch {
      respData = { url: respText.trim() }
    }

    const checkoutUrl = respData.url || respData.checkout_url || respData.link || respText.trim()

    // Update order with checkout info
    const { error: updateError } = await supabase
      .from('julia_orders')
      .update({
        order_nsu: orderNsu,
        checkout_url: checkoutUrl,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (updateError) {
      console.error('[infinitypay-checkout] Update error:', updateError)
    }

    return new Response(JSON.stringify({ checkout_url: checkoutUrl, order_nsu: orderNsu }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[infinitypay-checkout] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
