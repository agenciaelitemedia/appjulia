// =====================================================
// telephony-order-create
// Cria order em telephony_orders com status='draft'.
// Calcula totais server-side; nunca confia em valores do client.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BILLING_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
}

// Pricing rules (centavos)
const SETUP_FEE_MONTHLY = 19700           // R$ 197,00
const ADDON_PRICE_MONTHLY_CENTS = 9990    // R$ 99,90/mês
// Para semestral/anual addons são grátis. Trimestral cobra normal.

function priceFromPlan(plan: any, period: string): number {
  // Tabela tem price_monthly, price_quarterly, price_semiannual, price_annual em numeric (R$)
  const map: Record<string, string> = {
    monthly: 'price_monthly',
    quarterly: 'price_quarterly',
    semiannual: 'price_semiannual',
    annual: 'price_annual',
  }
  const col = map[period]
  const value = Number(plan[col] ?? plan.price ?? 0)
  return Math.round(value * 100)  // converte para centavos
}

function calcAddonsTotal(period: string, recording: boolean, transcription: boolean) {
  const months = BILLING_PERIOD_MONTHS[period] ?? 1
  const isFree = period === 'semiannual' || period === 'annual'
  const unit = isFree ? 0 : ADDON_PRICE_MONTHLY_CENTS
  return {
    recording_total: recording ? unit * months : 0,
    transcription_total: transcription ? unit * months : 0,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      client_id, plan_id, billing_period,
      extra_extensions = 0,
      recording_enabled = false,
      transcription_enabled = false,
      customer_name, customer_document, customer_email, customer_whatsapp,
    } = body

    if (!client_id || !plan_id || !billing_period) {
      return json({ error: 'client_id, plan_id e billing_period são obrigatórios' }, 400)
    }
    if (!BILLING_PERIOD_MONTHS[billing_period]) {
      return json({ error: 'billing_period inválido' }, 400)
    }
    if (!customer_name || !customer_document || !customer_email) {
      return json({ error: 'Dados do cliente incompletos (nome, documento, email)' }, 400)
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Busca plano
    const { data: plan, error: planErr } = await sb
      .from('phone_extension_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()
    if (planErr || !plan) return json({ error: 'Plano não encontrado ou inativo' }, 404)

    // 2. Calcula totais
    const planPrice = priceFromPlan(plan, billing_period)
    const setupFee = billing_period === 'monthly' ? SETUP_FEE_MONTHLY : 0
    const { recording_total, transcription_total } = calcAddonsTotal(
      billing_period, recording_enabled, transcription_enabled
    )

    const months = BILLING_PERIOD_MONTHS[billing_period]
    const extraUnit = Math.round(Number(plan.extra_extension_price ?? 0) * 100) // R$ → centavos
    const extras_total = extra_extensions * extraUnit * months

    const total_amount = planPrice + setupFee + recording_total + transcription_total + extras_total

    // 3. Cria order
    const { data: order, error: insErr } = await sb
      .from('telephony_orders')
      .insert({
        client_id: Number(client_id),
        customer_name, customer_document, customer_email,
        customer_whatsapp: customer_whatsapp || null,
        plan_id, plan_name: plan.name,
        billing_period,
        extra_extensions,
        recording_enabled, transcription_enabled,
        plan_price: planPrice,
        setup_fee: setupFee,
        recording_total,
        transcription_total,
        extra_extensions_total: extras_total,
        total_amount,
        status: 'draft',
        payment_gateway: 'mercadopago',
      })
      .select('id, total_amount')
      .single()

    if (insErr || !order) {
      console.error('[telephony-order-create] insert error:', insErr)
      return json({ error: 'Falha ao criar pedido: ' + (insErr?.message ?? 'unknown') }, 500)
    }

    return json({ order_id: order.id, total_amount: order.total_amount })
  } catch (err) {
    console.error('[telephony-order-create] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
