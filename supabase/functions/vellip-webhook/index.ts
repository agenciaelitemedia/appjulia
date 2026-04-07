import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const cod_agent = url.searchParams.get('cod_agent') || null

    const body = await req.json()
    console.log('[vellip-webhook] Received:', JSON.stringify(body).substring(0, 500))

    // Validate required fields
    const dest = body.dest || body.cd_dest
    const cd_id = body.cd_id
    if (!dest || !cd_id) {
      console.log('[vellip-webhook] Missing dest or cd_id, ignoring')
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error } = await supabase.from('vellip_call_logs').insert({
      cod_agent,
      phone: dest,
      cd_id,
      cd_date: body.cd_date || null,
      cd_time: body.cd_time || null,
      cd_time_start: body.cd_time_start || null,
      cd_time_end: body.cd_time_end || null,
      cd_time_sec: body.cd_time_sec ?? null,
      cd_time_sec2: body.cd_time_sec2 ?? null,
      cd_price: body.cd_price || null,
      cd_value: body.cd_value || null,
      cd_name: body.cd_name || null,
      cd_route: body.cd_route || null,
      cd_called_status: body.cd_called_status || null,
      cd_resp1: body.cd_resp1 || null,
      saldo: body.saldo || null,
      raw_payload: body,
    })

    if (error) {
      console.error('[vellip-webhook] Insert error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[vellip-webhook] Saved call from', dest, 'cd_id:', cd_id)

    // Auto-create CRM card if cd_resp1 == "1"
    const resp1 = String(body.cd_resp1 ?? '')
    if (resp1 === '1') {
      const { data: stage } = await supabase
        .from('crm_comercial_stages')
        .select('id')
        .eq('name', 'Interessados')
        .single()

      if (stage) {
        const { data: card } = await supabase
          .from('crm_comercial_cards')
          .insert({
            stage_id: stage.id,
            contact_name: dest,
            contact_phone: dest,
            cod_agent,
            origin: 'vellip',
            notes: 'Vindo de campanha da Vellip',
          })
          .select('id')
          .single()

        if (card) {
          await supabase.from('crm_comercial_history').insert({
            card_id: card.id,
            to_stage_id: stage.id,
            notes: 'Card criado via webhook Vellip',
          })
        }
        console.log('[vellip-webhook] CRM card created for', dest)
      }
    }

    return new Response(JSON.stringify({ received: true, phone: dest, cd_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[vellip-webhook] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
