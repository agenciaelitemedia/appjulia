// =====================================================
// telephony-provision
// Disparado após webhook confirmar pagamento.
// Idempotente: verifica provisioned_at antes de criar.
//
// Steps:
// 1. Lê telephony_orders WHERE id=order_id AND status='paid' AND provisioned_at IS NULL
// 2. Usa client_id do pedido como chave principal de provisionamento
// 3. Seleciona provedor default
// 4. INSERT phone_config (chaveado por client_id)
// 5. INSERT phone_user_plans (chaveado por client_id)
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

    // 2. Valida client_id (chave principal do provisionamento)
    const clientId = order.client_id ? Number(order.client_id) : null
    if (!clientId || !Number.isFinite(clientId)) {
      const errMsg = `client_id inválido no pedido: ${order.client_id}`
      await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 400)
    }
    // cod_agent é opcional/legado. Reaproveita o do pedido e, se ausente,
    // tenta herdar de registros já existentes do mesmo cliente.
    let codAgent = (order.cod_agent as string | null) ?? null
    if (!codAgent) {
      const [{ data: existingCfg }, { data: existingPlan }] = await Promise.all([
        (sb.from('phone_config' as never).select('cod_agent').eq('client_id', clientId).not('cod_agent', 'is', null).order('id', { ascending: false }).limit(1) as any).maybeSingle(),
        (sb.from('phone_user_plans' as never).select('cod_agent').eq('client_id', clientId).not('cod_agent', 'is', null).order('id', { ascending: false }).limit(1) as any).maybeSingle(),
      ])
      codAgent = existingCfg?.cod_agent ?? existingPlan?.cod_agent ?? null
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

    // 4. Cria phone_config (idempotente: verifica se já existe pra esse client_id+provider)
    const { data: existingCfg } = await (sb
      .from('phone_config' as never)
      .select('id')
      .eq('provider', provider.provider)
      .eq('client_id', clientId)
      .eq('is_active', true) as any)
      .maybeSingle()

    let configId: number
    if (existingCfg?.id) {
      configId = existingCfg.id
      console.log('[telephony-provision] reusando phone_config existente', { configId, clientId })
    } else {
      const cfgPayload: Record<string, unknown> = {
        client_id: clientId,
        provider: provider.provider,
        is_active: true,
        cod_agent: codAgent,
      }
      if (!codAgent) {
        console.log('[telephony-provision] cod_agent ausente — provisionando puramente por client_id', clientId)
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
        // Trata duplicata: a constraint uq_phone_config_client_provider_active garante 1 ativa
        // por (client_id, provider). Em race condition, recupera a existente.
        const isDup = (cfgErr?.code === '23505') || /duplicate key|uq_phone_config_client_provider_active/i.test(cfgErr?.message ?? '')
        if (isDup) {
          const { data: dupCfg } = await (sb
            .from('phone_config' as never)
            .select('id')
            .eq('provider', provider.provider)
            .eq('client_id', clientId)
            .eq('is_active', true) as any)
            .maybeSingle()
          if (dupCfg?.id) {
            configId = dupCfg.id
            console.log('[telephony-provision] phone_config duplicada — reusando id existente', { configId, clientId })
          } else {
            const errMsg = `Falha ao recuperar phone_config após duplicata para client_id=${clientId}`
            await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
            return json({ error: errMsg }, 500)
          }
        } else {
          const errMsg = `Falha ao criar phone_config: ${cfgErr?.message ?? 'unknown'}`
          await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
          return json({ error: errMsg }, 500)
        }
      } else {
        configId = newCfg.id
      }
    }

    // 5. Cria phone_user_plans
    const months = BILLING_PERIOD_MONTHS[order.billing_period as string] ?? 1
    const startDate = new Date().toISOString().slice(0, 10)
    const dueDate = addMonthsIso(months)

    // Desativa planos anteriores do mesmo cliente
    await (sb as any).from('phone_user_plans')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('client_id', clientId)

    const planPayload: Record<string, unknown> = {
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
      cod_agent: codAgent,
    }

    const { data: newPlan, error: planErr } = await (sb as any)
      .from('phone_user_plans')
      .insert(planPayload)
      .select('id')
      .single()
    if (planErr || !newPlan) {
      const errMsg = `Falha ao criar phone_user_plans: ${planErr?.message ?? 'unknown'}`
      await sb.from('telephony_orders').update({ provisioning_error: errMsg, updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ error: errMsg }, 500)
    }

    // 6. Marca order como provisioned
    const orderUpdate: Record<string, unknown> = {
      status: 'provisioned',
      provisioned_at: new Date().toISOString(),
      provider_id: provider.id,
      user_plan_id: newPlan.id,
      config_id: configId,
      provisioning_error: null,
      updated_at: new Date().toISOString(),
    }
    if (codAgent) orderUpdate.cod_agent = codAgent
    const { error: updErr } = await sb.from('telephony_orders').update(orderUpdate).eq('id', order_id)
    if (updErr) {
      console.error('[telephony-provision] FALHA AO ATUALIZAR ORDER', updErr)
      // Tenta novamente sem as colunas novas (caso o schema cache esteja defasado)
      const fallback: Record<string, unknown> = {
        status: 'provisioned',
        provisioned_at: new Date().toISOString(),
        provisioning_error: null,
        updated_at: new Date().toISOString(),
      }
      const { error: updErr2 } = await sb.from('telephony_orders').update(fallback).eq('id', order_id)
      if (updErr2) console.error('[telephony-provision] FALHA NO FALLBACK UPDATE', updErr2)
    }

    console.log('[telephony-provision] OK order=', order_id, 'client_id=', clientId)
    return json({ status: 'provisioned', order_id, client_id: clientId, plan_id: newPlan.id, config_id: configId })
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
