// =====================================================
// queue-provision
// Após pagamento, cria/ativa o queue_user_plans correspondente.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
}

function addMonthsISO(start: string, months: number): string {
  const d = new Date(start + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id é obrigatório' }, 400)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error } = await sb
      .from('queue_orders')
      .select('*')
      .eq('id', order_id)
      .single()
    if (error || !order) return json({ error: 'Pedido não encontrado' }, 404)

    if (order.status !== 'paid') {
      return json({ error: `Pedido não está pago (status=${order.status})` }, 400)
    }
    if (order.status === 'provisioned' || order.user_plan_id) {
      return json({ ok: true, already_provisioned: true })
    }

    const clientIdNum = Number(order.client_id)
    if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
      await sb.from('queue_orders').update({
        provisioning_error: `client_id inválido: ${order.client_id}`,
        updated_at: new Date().toISOString(),
      }).eq('id', order_id)
      return json({ error: 'client_id inválido' }, 400)
    }

    // Busca nome/business do cliente
    let clientName: string | null = null
    let businessName: string | null = null
    let codAgent: number | null = null
    try {
      const { data: vr } = await sb.functions.invoke('db-query', {
        body: {
          action: 'raw',
          data: {
            query: 'SELECT name, business_name FROM clients WHERE id = $1 LIMIT 1',
            params: [clientIdNum],
          },
        },
      })
      const row = (vr as any)?.data?.[0] ?? (vr as any)?.[0] ?? null
      if (row) { clientName = row.name ?? null; businessName = row.business_name ?? null }

      const { data: ar } = await sb.functions.invoke('db-query', {
        body: {
          action: 'raw',
          data: {
            query: 'SELECT cod_agent::bigint AS cod_agent FROM agents WHERE client_id = $1 ORDER BY id ASC LIMIT 1',
            params: [clientIdNum],
          },
        },
      })
      const arow = (ar as any)?.data?.[0] ?? (ar as any)?.[0] ?? null
      if (arow?.cod_agent != null) codAgent = Number(arow.cod_agent)
    } catch (e) {
      console.warn('[queue-provision] client lookup failed', (e as Error).message)
    }

    // Modelo cumulativo: planos anteriores permanecem ativos.
    const startDate = new Date().toISOString().slice(0, 10)
    const months = PERIOD_MONTHS[order.billing_period] ?? 1
    const dueDate = addMonthsISO(startDate, months)

    const { data: userPlan, error: insErr } = await sb.from('queue_user_plans').insert({
      client_id: clientIdNum,
      cod_agent: codAgent,
      plan_id: order.plan_id,
      billing_period: order.billing_period,
      extra_queues: order.extra_queues,
      is_active: true,
      start_date: startDate,
      due_date: dueDate,
      client_name: clientName ?? order.customer_name,
      business_name: businessName,
    }).select('id').single()

    if (insErr || !userPlan) {
      await sb.from('queue_orders').update({
        provisioning_error: 'Falha ao criar user_plan: ' + (insErr?.message ?? 'unknown'),
        updated_at: new Date().toISOString(),
      }).eq('id', order_id)
      return json({ error: 'Falha ao provisionar' }, 500)
    }

    // ===== Soma ao QUEUE_LIMIT do cliente (idempotente via metadata flag) =====
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const alreadyApplied = meta?.queue_limit_applied === true
    let appliedDelta = Number(meta?.queue_limit_delta ?? 0) || 0

    if (!alreadyApplied) {
      // Busca max_queues do plano contratado
      const { data: plan } = await sb
        .from('queue_plans')
        .select('max_queues')
        .eq('id', order.plan_id)
        .single()
      const maxQueues = Number((plan as any)?.max_queues ?? 0) || 0
      const extraQueues = Number(order.extra_queues ?? 0) || 0
      appliedDelta = maxQueues + extraQueues

      if (appliedDelta > 0) {
        const clientIdStr = String(order.client_id)
        const { data: existing } = await sb
          .from('chat_client_settings')
          .select('id, settings')
          .eq('client_id', clientIdStr)
          .maybeSingle()

        if (existing) {
          const currentSettings = ((existing as any).settings ?? {}) as Record<string, unknown>
          const currentLimit = Number(currentSettings?.QUEUE_LIMIT ?? 1) || 1
          const newLimit = currentLimit + appliedDelta
          await sb
            .from('chat_client_settings')
            .update({
              settings: { ...currentSettings, QUEUE_LIMIT: newLimit },
              updated_at: new Date().toISOString(),
            })
            .eq('id', (existing as any).id)
        } else {
          await sb.from('chat_client_settings').insert({
            client_id: clientIdStr,
            client_name: clientName,
            client_business_name: businessName,
            settings: { QUEUE_LIMIT: appliedDelta, ALLOW_GROUPS: false },
          })
        }
      }
    }

    await sb.from('queue_orders').update({
      status: 'provisioned',
      provisioned_at: new Date().toISOString(),
      user_plan_id: userPlan.id,
      provisioning_error: null,
      metadata: { ...meta, queue_limit_applied: true, queue_limit_delta: appliedDelta },
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    return json({ ok: true, user_plan_id: userPlan.id })
  } catch (err) {
    console.error('[queue-provision] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}