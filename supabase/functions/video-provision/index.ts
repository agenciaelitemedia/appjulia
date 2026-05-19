// =====================================================
// video-provision
// Cria/renova video_user_plans para o cliente, idempotente.
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BILLING_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
}

function addMonthsIso(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id é obrigatório' }, 400)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order, error: orderErr } = await sb
      .from('video_orders')
      .select('*')
      .eq('id', order_id)
      .single()
    if (orderErr || !order) return json({ error: 'Pedido não encontrado' }, 404)

    if (order.provisioned_at) return json({ status: 'already_provisioned', order_id })
    if (order.status !== 'paid') {
      return json({ error: `Status inválido: ${order.status} (esperado 'paid')` }, 400)
    }

    const clientId = order.client_id
    if (!clientId) {
      const errMsg = `client_id inválido no pedido: ${order.client_id}`
      await sb.from('video_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 400)
    }

    const { data: plan, error: planErr } = await sb
      .from('video_plans')
      .select('*')
      .eq('id', order.plan_id)
      .single()
    if (planErr || !plan) {
      const errMsg = `Plano ${order.plan_id} não encontrado`
      await sb.from('video_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 400)
    }

    const months = BILLING_PERIOD_MONTHS[order.billing_period as string] ?? 1
    const minutesQuota = Number(plan.included_minutes ?? 0) * months
      + Number(order.extra_minute_packs ?? 0) * Number(plan.extra_minutes_pack_size ?? 0) * months

    // Cancela assinaturas ativas anteriores do mesmo cliente
    await (sb as any).from('video_user_plans')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('status', 'active')
      .eq('client_id', clientId)

    const planPayload = {
      client_id: clientId,
      plan_id: order.plan_id,
      billing_period: order.billing_period,
      status: 'active',
      minutes_quota: minutesQuota,
      minutes_used: 0,
      max_concurrent_rooms: Number(plan.max_concurrent_rooms ?? 1),
      recording_enabled: order.recording_enabled || plan.recording_included,
      transcription_enabled: order.transcription_enabled || plan.transcription_included,
      period_start: new Date().toISOString(),
      period_end: addMonthsIso(months),
      activated_at: new Date().toISOString(),
      metadata: { source_order_id: order_id, customer_name: order.customer_name },
    }

    const { data: newPlan, error: insErr } = await (sb as any)
      .from('video_user_plans')
      .insert(planPayload)
      .select('id')
      .single()
    if (insErr || !newPlan) {
      const errMsg = `Falha ao criar video_user_plans: ${insErr?.message ?? 'unknown'}`
      await sb.from('video_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 500)
    }

    await sb.from('video_orders').update({
      status: 'provisioned',
      provisioned_at: new Date().toISOString(),
      user_plan_id: newPlan.id,
      provisioning_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    console.log('[video-provision] OK order=', order_id, 'client_id=', clientId, 'quota=', minutesQuota)
    return json({ status: 'provisioned', order_id, client_id: clientId, user_plan_id: newPlan.id, minutes_quota: minutesQuota })
  } catch (err) {
    console.error('[video-provision] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}