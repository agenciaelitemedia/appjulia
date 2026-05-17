// =====================================================
// queue-order-create
// Cria order em queue_orders com status='draft'.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      client_id, plan_id, billing_period,
      extra_queues = 0,
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

    // Valida client_id na tabela externa
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
      if (!row) return json({ error: `Cliente com id=${clientIdNum} não encontrado.` }, 400)
    } catch (e) {
      console.warn('[queue-order-create] client validation skipped', (e as Error).message)
    }

    const { data: plan, error: planErr } = await sb
      .from('queue_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()
    if (planErr || !plan) return json({ error: 'Plano não encontrado ou inativo' }, 404)

    const planPrice = priceFromPlan(plan, billing_period)
    const setupFee = setupFeeFromPlan(plan, billing_period)
    const months = BILLING_PERIOD_MONTHS[billing_period]
    const extraUnit = Math.round(Number(plan.extra_queue_price ?? 0) * 100)
    const extras_total = extra_queues * extraUnit * months
    const total_amount = planPrice + setupFee + extras_total

    // Validação client x server
    const TOLERANCE_CENTS = 1
    const cb = (body.client_breakdown_cents ?? null) as null | {
      plan?: number; setup?: number; extras?: number; total?: number;
    }
    const expectedTotalCents = body.expected_total_cents != null
      ? Math.round(Number(body.expected_total_cents))
      : (cb?.total != null ? Math.round(Number(cb.total)) : null)

    const divergences: Array<{ field: string; client: number; server: number; diff: number }> = []
    function check(field: string, c: number | undefined | null, s: number) {
      if (c === undefined || c === null) return
      const cv = Math.round(Number(c))
      const diff = Math.abs(cv - s)
      if (diff > TOLERANCE_CENTS) divergences.push({ field, client: cv, server: s, diff })
    }
    if (cb) {
      check('plan', cb.plan, planPrice)
      check('setup', cb.setup, setupFee)
      check('extras', cb.extras, extras_total)
    }
    if (expectedTotalCents !== null) check('total', expectedTotalCents, total_amount)

    if (divergences.length > 0) {
      console.warn('[queue-order-create] PRICE_DIVERGENCE', JSON.stringify({ plan_id, divergences }))
    }

    const { data: order, error: insErr } = await sb
      .from('queue_orders')
      .insert({
        client_id: String(clientIdNum),
        customer_name, customer_document, customer_email,
        customer_whatsapp: customer_whatsapp || null,
        plan_id, plan_name: plan.name,
        billing_period,
        extra_queues,
        plan_price: planPrice,
        setup_fee: setupFee,
        extra_queues_total: extras_total,
        total_amount,
        status: 'draft',
        payment_gateway: 'mercadopago',
        metadata: divergences.length > 0
          ? { price_divergence: { detected_at: new Date().toISOString(), divergences } }
          : null,
      })
      .select('id, total_amount')
      .single()

    if (insErr || !order) {
      console.error('[queue-order-create] insert error', insErr)
      return json({ error: 'Falha ao criar pedido: ' + (insErr?.message ?? 'unknown') }, 500)
    }

    return json({
      order_id: order.id,
      total_amount: order.total_amount,
      price_validation: {
        ok: divergences.length === 0,
        divergences,
        server_breakdown_cents: { plan: planPrice, setup: setupFee, extras: extras_total, total: total_amount },
      },
    })
  } catch (err) {
    console.error('[queue-order-create] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}