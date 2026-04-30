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

function setupFeeFromPlan(plan: any, period: string): number {
  // Espelha src/pages/telefonia/contratar/types.ts → setupFeeForPeriod()
  // Lê o setup fee real cadastrado no plano por período. null/undefined = sem taxa.
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
  return Math.round(n * 100) // R$ → centavos
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
    const clientIdNum = Number(client_id)
    if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
      return json({ error: `client_id inválido: ${client_id}` }, 400)
    }
    if (!BILLING_PERIOD_MONTHS[billing_period]) {
      return json({ error: 'billing_period inválido' }, 400)
    }
    if (!customer_name || !customer_document || !customer_email) {
      return json({ error: 'Dados do cliente incompletos (nome, documento, email)' }, 400)
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 0. Valida que client_id existe na tabela externa de clientes (evita pedidos órfãos
    //    e o bug histórico de quem mandava user.id em vez de client_id).
    try {
      const { data: vr } = await sb.functions.invoke('db-query', {
        body: {
          action: 'raw',
          data: {
            query: 'SELECT id, name, business_name FROM clients WHERE id = $1 LIMIT 1',
            params: [clientIdNum],
          },
        },
      })
      const row = (vr as any)?.data?.[0] ?? (vr as any)?.[0] ?? null
      if (!row) {
        return json({ error: `Cliente com id=${clientIdNum} não foi encontrado.` }, 400)
      }
      console.log('[telephony-order-create] client validated', { client_id: clientIdNum, name: row.name, business_name: row.business_name })
    } catch (e) {
      console.warn('[telephony-order-create] client validation skipped (db-query failure)', (e as Error).message)
      // Não bloqueia em caso de falha do db-query — apenas loga.
    }

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
    const setupFee = setupFeeFromPlan(plan, billing_period)
    const { recording_total, transcription_total } = calcAddonsTotal(
      billing_period, recording_enabled, transcription_enabled
    )

    const months = BILLING_PERIOD_MONTHS[billing_period]
    const extraUnit = Math.round(Number(plan.extra_extension_price ?? 0) * 100) // R$ → centavos
    const extras_total = extra_extensions * extraUnit * months

    const total_amount = planPrice + setupFee + recording_total + transcription_total + extras_total

    // 2.1 Validação cliente x servidor (breakdown opcional enviado pelo frontend, em centavos)
    // Permite tolerância de 1 centavo por componente para diferenças de arredondamento.
    const TOLERANCE_CENTS = 1
    const clientBreakdown = (body.client_breakdown_cents ?? null) as null | {
      plan?: number
      setup?: number
      recording?: number
      transcription?: number
      extras?: number
      total?: number
    }
    const expectedTotalCents = body.expected_total_cents != null
      ? Math.round(Number(body.expected_total_cents))
      : (clientBreakdown?.total != null ? Math.round(Number(clientBreakdown.total)) : null)

    const divergences: Array<{ field: string; client: number; server: number; diff: number }> = []
    function check(field: string, clientVal: number | undefined | null, serverVal: number) {
      if (clientVal === undefined || clientVal === null) return
      const c = Math.round(Number(clientVal))
      const diff = Math.abs(c - serverVal)
      if (diff > TOLERANCE_CENTS) {
        divergences.push({ field, client: c, server: serverVal, diff })
      }
    }
    if (clientBreakdown) {
      check('plan', clientBreakdown.plan, planPrice)
      check('setup', clientBreakdown.setup, setupFee)
      check('recording', clientBreakdown.recording, recording_total)
      check('transcription', clientBreakdown.transcription, transcription_total)
      check('extras', clientBreakdown.extras, extras_total)
    }
    if (expectedTotalCents !== null) {
      check('total', expectedTotalCents, total_amount)
    }

    if (divergences.length > 0) {
      console.warn('[telephony-order-create] PRICE_DIVERGENCE detected', JSON.stringify({
        plan_id, billing_period, extra_extensions,
        recording_enabled, transcription_enabled,
        server_breakdown_cents: {
          plan: planPrice, setup: setupFee,
          recording: recording_total, transcription: transcription_total,
          extras: extras_total, total: total_amount,
        },
        client_breakdown_cents: clientBreakdown,
        expected_total_cents: expectedTotalCents,
        divergences,
      }))
    } else if (clientBreakdown || expectedTotalCents !== null) {
      console.log('[telephony-order-create] price validation OK', JSON.stringify({
        plan_id, billing_period, total_cents: total_amount,
      }))
    }

    // 3. Cria order
    const { data: order, error: insErr } = await sb
      .from('telephony_orders')
      .insert({
        client_id: String(client_id),
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
      console.error('[telephony-order-create] insert error:', insErr)
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
