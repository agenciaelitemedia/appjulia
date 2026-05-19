// =====================================================
// video-order-create
// Cria order em video_orders com status='draft'.
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

function priceFromPlan(plan: any, period: string): number {
  const map: Record<string, string> = {
    monthly: 'price_monthly',
    quarterly: 'price_quarterly',
    semiannual: 'price_semiannual',
    annual: 'price_annual',
  }
  const value = Number(plan[map[period]] ?? 0)
  return Math.round(value * 100)
}

function setupFeeFromPlan(plan: any, period: string): number {
  const map: Record<string, string> = {
    monthly: 'setup_fee_monthly',
    quarterly: 'setup_fee_quarterly',
    semiannual: 'setup_fee_semiannual',
    annual: 'setup_fee_annual',
  }
  const raw = plan[map[period]]
  if (raw === null || raw === undefined || raw === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function calcAddonsTotal(plan: any, period: string, recording: boolean, transcription: boolean) {
  const months = BILLING_PERIOD_MONTHS[period] ?? 1
  const isFree = period === 'semiannual' || period === 'annual'
  const recUnit = plan.recording_included
    ? 0
    : Math.round(Number(plan.recording_addon_price ?? 99.9) * 100)
  const trUnit = plan.transcription_included
    ? 0
    : Math.round(Number(plan.transcription_addon_price ?? 99.9) * 100)
  return {
    recording_total: recording && !plan.recording_included
      ? (isFree ? 0 : recUnit * months)
      : 0,
    transcription_total: transcription && !plan.transcription_included
      ? (isFree ? 0 : trUnit * months)
      : 0,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      client_id, plan_id, billing_period,
      extra_minute_packs = 0,
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

    const { data: plan, error: planErr } = await sb
      .from('video_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()
    if (planErr || !plan) return json({ error: 'Plano não encontrado ou inativo' }, 404)

    const planPrice = priceFromPlan(plan, billing_period)
    const setupFee = setupFeeFromPlan(plan, billing_period)
    const { recording_total, transcription_total } = calcAddonsTotal(
      plan, billing_period, recording_enabled, transcription_enabled,
    )
    const months = BILLING_PERIOD_MONTHS[billing_period]
    const extraUnit = Math.round(Number(plan.extra_minutes_pack_price ?? 0) * 100)
    const extras_total = Number(extra_minute_packs) * extraUnit * months
    const total_amount = planPrice + setupFee + recording_total + transcription_total + extras_total

    // Validação cliente x servidor
    const TOLERANCE_CENTS = 1
    const clientBreakdown = (body.client_breakdown_cents ?? null) as null | {
      plan?: number; setup?: number; recording?: number; transcription?: number; extras?: number; total?: number
    }
    const expectedTotalCents = body.expected_total_cents != null
      ? Math.round(Number(body.expected_total_cents))
      : (clientBreakdown?.total != null ? Math.round(Number(clientBreakdown.total)) : null)

    const divergences: Array<{ field: string; client: number; server: number; diff: number }> = []
    function check(field: string, c: number | undefined | null, s: number) {
      if (c === undefined || c === null) return
      const cv = Math.round(Number(c))
      const diff = Math.abs(cv - s)
      if (diff > TOLERANCE_CENTS) divergences.push({ field, client: cv, server: s, diff })
    }
    if (clientBreakdown) {
      check('plan', clientBreakdown.plan, planPrice)
      check('setup', clientBreakdown.setup, setupFee)
      check('recording', clientBreakdown.recording, recording_total)
      check('transcription', clientBreakdown.transcription, transcription_total)
      check('extras', clientBreakdown.extras, extras_total)
    }
    if (expectedTotalCents !== null) check('total', expectedTotalCents, total_amount)

    const { data: order, error: insErr } = await sb
      .from('video_orders')
      .insert({
        client_id: String(client_id),
        customer_name, customer_document, customer_email,
        customer_whatsapp: customer_whatsapp || null,
        plan_id, plan_name: plan.name,
        billing_period,
        extra_minute_packs: Number(extra_minute_packs) || 0,
        recording_enabled, transcription_enabled,
        plan_price: planPrice,
        setup_fee: setupFee,
        recording_total,
        transcription_total,
        extras_total,
        total_amount,
        status: 'draft',
        payment_gateway: 'mercadopago',
        metadata: divergences.length > 0
          ? {
              price_divergence: {
                detected_at: new Date().toISOString(),
                client_breakdown_cents: clientBreakdown,
                expected_total_cents: expectedTotalCents,
                server_breakdown_cents: {
                  plan: planPrice, setup: setupFee,
                  recording: recording_total, transcription: transcription_total,
                  extras: extras_total, total: total_amount,
                },
                divergences,
              },
            }
          : null,
      })
      .select('id, total_amount')
      .single()

    if (insErr || !order) {
      console.error('[video-order-create] insert error:', insErr)
      return json({ error: 'Falha ao criar pedido: ' + (insErr?.message ?? 'unknown') }, 500)
    }

    return json({
      order_id: order.id,
      total_amount: order.total_amount,
      price_validation: {
        ok: divergences.length === 0,
        divergences,
        server_breakdown_cents: {
          plan: planPrice, setup: setupFee,
          recording: recording_total, transcription: transcription_total,
          extras: extras_total, total: total_amount,
        },
      },
    })
  } catch (err) {
    console.error('[video-order-create] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}