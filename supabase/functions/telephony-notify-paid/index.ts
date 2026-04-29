// =====================================================
// telephony-notify-paid
// Envia mensagem WhatsApp ao cliente confirmando o pagamento
// e a liberação do plano de telefonia.
// Disparado em fire-and-forget pelo mercadopago-webhook.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  semiannual: 'semestral',
  annual: 'anual',
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D+/g, '')
}

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id é obrigatório' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const sb = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error: orderErr } = await sb
      .from('telephony_orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      console.error('[telephony-notify-paid] order not found:', order_id, orderErr)
      return json({ error: 'Pedido não encontrado' }, 404)
    }

    const phone = onlyDigits(order.customer_whatsapp)
    if (!phone || phone.length < 10) {
      console.log('[telephony-notify-paid] no valid whatsapp for order', order_id)
      return json({ skipped: 'no_whatsapp' })
    }

    // Busca uma queue UaZapi ativa do client para enviar a mensagem
    const { data: queue } = await sb
      .from('queue_providers')
      .select('evo_url, evo_apikey, evo_instancia')
      .eq('client_id', order.client_id)
      .eq('provider_type', 'uazapi')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const evoUrl = queue?.evo_url || Deno.env.get('UAZAPI_BASE_URL')
    const evoToken = queue?.evo_apikey || Deno.env.get('UAZAPI_ADMIN_TOKEN')
    const evoInstancia = queue?.evo_instancia

    if (!evoUrl || !evoToken) {
      console.warn('[telephony-notify-paid] no UaZapi credentials available')
      return json({ skipped: 'no_credentials' })
    }

    const periodLabel = PERIOD_LABELS[order.billing_period] || order.billing_period
    const message =
      `✅ *Pagamento confirmado!*\n\n` +
      `Olá, ${order.customer_name.split(' ')[0]}! Recebemos a confirmação do seu pagamento da telefonia.\n\n` +
      `📞 *Plano:* ${order.plan_name} (${periodLabel})\n` +
      `💰 *Valor:* ${fmtBRL(order.total_amount)}\n` +
      `🆔 *Pedido:* ${order.order_nsu || order.id.substring(0, 8)}\n\n` +
      `Estamos liberando seus ramais agora — em instantes você poderá usar a telefonia direto no painel.\n\n` +
      `Qualquer dúvida é só responder esta mensagem.`

    // UaZapi: POST /send/text com header "token: <instancia_token>"
    // Quando vem da queue, evo_apikey já é o token específico da instância.
    // Quando cai no admin token, usa-o diretamente (envio admin).
    const sendUrl = `${evoUrl.replace(/\/$/, '')}/send/text`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      token: evoToken,
    }

    const resp = await fetch(sendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: phone, text: message }),
    })

    const respText = await resp.text()
    if (!resp.ok) {
      console.error('[telephony-notify-paid] UaZapi send failed', resp.status, respText.substring(0, 200))
      return json({ error: `UaZapi ${resp.status}`, details: respText.substring(0, 200) }, 502)
    }

    console.log('[telephony-notify-paid] sent to', phone, 'order', order_id)
    return json({ success: true, phone, instancia: evoInstancia ?? null })
  } catch (err) {
    console.error('[telephony-notify-paid] error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}