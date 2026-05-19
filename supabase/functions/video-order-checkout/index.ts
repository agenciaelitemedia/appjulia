// =====================================================
// video-order-checkout
// Gera URL Mercado Pago para um video_order.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'mensal', quarterly: 'trimestral', semiannual: 'semestral', annual: 'anual',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id é obrigatório' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const sb = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error } = await sb
      .from('video_orders')
      .select('*')
      .eq('id', order_id)
      .single()
    if (error || !order) return json({ error: 'Pedido não encontrado' }, 404)

    const { data: mpConfig } = await sb
      .from('julia_payment_config')
      .select('*')
      .eq('gateway', 'mercadopago')
      .single()
    if (!mpConfig) return json({ error: 'Config Mercado Pago não encontrada' }, 400)

    const cfg = mpConfig.config as Record<string, string>
    const accessToken = cfg.access_token
    if (!accessToken) return json({ error: 'access_token não configurado' }, 400)

    const isSandbox = mpConfig.is_sandbox
    const siteUrl = cfg.site_url || 'https://appjulia.lovable.app'
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`

    const items = [{
      title: `Videochamadas ${order.plan_name} (${PERIOD_LABELS[order.billing_period]})`,
      quantity: 1,
      unit_price: order.total_amount / 100,
      currency_id: 'BRL',
    }]

    const preference = {
      items,
      payer: { name: order.customer_name, email: order.customer_email || undefined },
      external_reference: order_id,
      notification_url: webhookUrl,
      back_urls: {
        success: `${siteUrl}/video/contratar?status=success`,
        failure: `${siteUrl}/video/contratar?status=failure`,
        pending: `${siteUrl}/video/contratar?status=pending`,
      },
      auto_return: 'approved',
      statement_descriptor: 'JULIA-VID',
      metadata: { order_type: 'video', order_id },
    }

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(preference),
    })
    const respText = await resp.text()
    if (!resp.ok) return json({ error: `Mercado Pago erro ${resp.status}: ${respText}` }, 400)

    const respData = JSON.parse(respText)
    const checkoutUrl = isSandbox ? respData.sandbox_init_point : respData.init_point
    const preferenceId = respData.id
    const orderNsu = `VID-MP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    await sb.from('video_orders').update({
      order_nsu: orderNsu,
      checkout_url: checkoutUrl,
      status: 'pending',
      mp_preference_id: preferenceId,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    return json({ checkout_url: checkoutUrl, order_nsu: orderNsu, preference_id: preferenceId })
  } catch (err) {
    console.error('[video-order-checkout] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}