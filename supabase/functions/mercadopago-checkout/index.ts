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

    // Fetch order
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

    // Fetch MP config
    const { data: mpConfig, error: cfgError } = await supabase
      .from('julia_payment_config')
      .select('*')
      .eq('gateway', 'mercadopago')
      .single()

    if (cfgError || !mpConfig) {
      return new Response(JSON.stringify({ error: 'Configuração do Mercado Pago não encontrada. Configure nas configurações de pagamento.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const config = mpConfig.config as Record<string, string>
    const accessToken = config.access_token
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Access Token do Mercado Pago não configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isSandbox = mpConfig.is_sandbox

    // Price in BRL (plan_price is in cents)
    const unitPrice = order.plan_price / 100

    const billingLabel: Record<string, string> = {
      monthly: '/mês',
      semiannual: '/semestre',
      annual: '/ano',
    }
    const periodSuffix = billingLabel[order.billing_period] || ''

    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`

    // Build preference
    const preference = {
      items: [
        {
          title: `${order.plan_name} ${periodSuffix}`.trim(),
          quantity: 1,
          unit_price: unitPrice,
          currency_id: 'BRL',
        },
      ],
      payer: {
        name: order.customer_name,
        email: order.customer_email || undefined,
      },
      external_reference: order_id,
      notification_url: webhookUrl,
      back_urls: {
        success: `${config.site_url || 'https://appjulia.lovable.app'}/comprar/sucesso`,
        failure: `${config.site_url || 'https://appjulia.lovable.app'}/comprar?status=failure`,
        pending: `${config.site_url || 'https://appjulia.lovable.app'}/comprar?status=pending`,
      },
      auto_return: 'approved',
      statement_descriptor: 'ATENDEJULIA',
    }

    console.log('[mercadopago-checkout] Creating preference:', JSON.stringify(preference))

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const respText = await resp.text()
    console.log('[mercadopago-checkout] Response status:', resp.status, 'body:', respText)

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Mercado Pago erro ${resp.status}: ${respText}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const respData = JSON.parse(respText)
    const checkoutUrl = isSandbox ? respData.sandbox_init_point : respData.init_point
    const preferenceId = respData.id

    const orderNsu = `JULIA-MP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Update order
    const { error: updateError } = await supabase
      .from('julia_orders')
      .update({
        order_nsu: orderNsu,
        checkout_url: checkoutUrl,
        status: 'pending',
        payment_gateway: 'mercadopago',
        mp_preference_id: preferenceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (updateError) {
      console.error('[mercadopago-checkout] Update error:', updateError)
    }

    return new Response(JSON.stringify({ checkout_url: checkoutUrl, order_nsu: orderNsu, preference_id: preferenceId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[mercadopago-checkout] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
