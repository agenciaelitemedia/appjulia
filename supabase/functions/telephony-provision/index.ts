// =====================================================
// telephony-provision
// Disparado após webhook confirmar pagamento.
// Idempotente: verifica provisioned_at antes de criar.
//
// Steps:
// 1. Lê telephony_orders WHERE id=order_id AND status='paid' AND provisioned_at IS NULL
// 2. Resolve cod_agent (via db-query → users.cod_agent ou user_agents)
// 3. Seleciona provedor default
// 4. INSERT phone_config (Configurações por Agente)
// 5. INSERT phone_user_plans (Agentes Telefonia)
// 6. UPDATE order: status='provisioned', referencias preenchidas
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
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function resolveCodAgent(supabaseUrl: string, serviceKey: string, clientId: number): Promise<string | null> {
  // Chama db-query (external DB) para obter cod_agent
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        action: 'raw',
        data: {
          query: `SELECT cod_agent FROM users WHERE id = $1 AND cod_agent IS NOT NULL LIMIT 1`,
          params: [clientId],
        },
      }),
    })
    const j = await r.json()
    const cod = j?.data?.[0]?.cod_agent
    if (cod) return String(cod)
  } catch (err) {
    console.warn('[telephony-provision] resolveCodAgent failed via users:', err)
  }
  // Fallback: user_agents (primeiro vinculado)
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        action: 'raw',
        data: {
          query: `SELECT cod_agent FROM user_agents WHERE user_id = $1 ORDER BY id ASC LIMIT 1`,
          params: [clientId],
        },
      }),
    })
    const j = await r.json()
    const cod = j?.data?.[0]?.cod_agent
    if (cod) return String(cod)
  } catch (err) {
    console.warn('[telephony-provision] resolveCodAgent failed via user_agents:', err)
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id é obrigatório' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Carrega order
    const { data: order, error: orderErr } = await sb
      .from('telephony_orders')
      .select('*')
      .eq('id', order_id)
      .single()
    if (orderErr || !order) return json({ error: 'Pedido não encontrado' }, 404)

    if (order.provisioned_at) {
      return json({ status: 'already_provisioned', order_id })
    }
    if (order.status !== 'paid') {
      return json({ error: `Status inválido: ${order.status} (esperado 'paid')` }, 400)
    }

    // 2. Resolve cod_agent
    let codAgent = order.cod_agent as string | null
    if (!codAgent) {
      codAgent = await resolveCodAgent(supabaseUrl, serviceKey, Number(order.client_id))
    }
    if (!codAgent) {
      const errMsg = `cod_agent não encontrado para client_id=${order.client_id}`
      await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 400)
    }

    // 3. Seleciona provider default
    const { data: provider, error: provErr } = await sb
      .from('telephony_providers')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (provErr || !provider) {
      const errMsg = 'Nenhum provedor default ativo. Cadastre em /admin/telefonia → Provedores.'
      await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 400)
    }

    // 4. Cria phone_config (idempotente: verifica se já existe pra esse cod_agent+provider)
    const clientId = order.client_id ? Number(order.client_id) : null
    const cfgQuery = sb
      .from('phone_config' as never)
      .select('id')
      .eq('provider', provider.provider) as any
    const { data: existingCfg } = await (clientId
      ? cfgQuery.eq('client_id', clientId)
      : cfgQuery.eq('cod_agent', codAgent)
    ).maybeSingle() as any

    let configId: number
    if (existingCfg?.id) {
      configId = existingCfg.id
    } else {
      const cfgPayload: Record<string, unknown> = {
        cod_agent: codAgent,
        client_id: clientId,
        provider: provider.provider,
        is_active: true,
      }
      if (provider.provider === 'api4com') {
        cfgPayload.api4com_domain = provider.api4com_domain
        cfgPayload.api4com_token = provider.api4com_token
        cfgPayload.sip_domain = provider.sip_domain
      } else {
        cfgPayload.threecplus_token = provider.threecplus_token
        cfgPayload.threecplus_base_url = provider.threecplus_base_url
        cfgPayload.threecplus_ws_url = provider.threecplus_ws_url
        cfgPayload.sip_domain = provider.sip_domain
      }

      const { data: newCfg, error: cfgErr } = await (sb as any)
        .from('phone_config')
        .insert(cfgPayload)
        .select('id')
        .single()
      if (cfgErr || !newCfg) {
        const errMsg = `Falha ao criar phone_config: ${cfgErr?.message ?? 'unknown'}`
        await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
        return json({ error: errMsg }, 500)
      }
      configId = newCfg.id
    }

    // 5. Cria phone_user_plans
    const months = BILLING_PERIOD_MONTHS[order.billing_period as string] ?? 1
    const startDate = new Date().toISOString().slice(0, 10)
    const dueDate = addMonthsIso(months)

    // Desativa planos anteriores do mesmo cliente (regra existente)
    {
      const upd = (sb as any).from('phone_user_plans')
        .update({ is_active: false })
        .eq('is_active', true)
      await (clientId ? upd.eq('client_id', clientId) : upd.eq('cod_agent', codAgent))
    }

    const { data: newPlan, error: planErr } = await (sb as any)
      .from('phone_user_plans')
      .insert({
        cod_agent: codAgent,
        client_id: clientId,
        plan_id: order.plan_id,
        billing_period: order.billing_period,
        extra_extensions: order.extra_extensions,
        recording_enabled: order.recording_enabled,
        transcription_enabled: order.transcription_enabled,
        start_date: startDate,
        due_date: dueDate,
        is_active: true,
        client_name: order.customer_name,
        source_order_id: order_id,
      })
      .select('id')
      .single()
    if (planErr || !newPlan) {
      const errMsg = `Falha ao criar phone_user_plans: ${planErr?.message ?? 'unknown'}`
      await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 500)
    }

    // 6. Marca order como provisioned
    await sb.from('telephony_orders').update({
      status: 'provisioned',
      provisioned_at: new Date().toISOString(),
      provider_id: provider.id,
      user_plan_id: newPlan.id,
      config_id: configId,
      cod_agent: codAgent,
      provisioning_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    console.log('[telephony-provision] OK order=', order_id, 'cod_agent=', codAgent)
    return json({ status: 'provisioned', order_id, cod_agent: codAgent, plan_id: newPlan.id, config_id: configId })
  } catch (err) {
    console.error('[telephony-provision] Error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
