// ============================================
// n8n_execute → Agent & Followup Reactive
// Reativa a sessão da Julia e reagenda o pré-followup
// para o lead no banco externo.
//
// Doc: supabase/functions/n8n_execute/README.md
// Memória: mem://features/n8n-execute/agent-and-followup-reactive
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { brPhoneVariants, toBrCanonicalByDDD } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const codAgent = String(body?.codAgent ?? '').trim();
    const whatsappNumber = String(body?.whatsappNumber ?? '').trim();
    const hubFila = String(body?.hubFila ?? '').trim();

    if (!codAgent || !whatsappNumber || !hubFila) {
      return new Response(
        JSON.stringify({ data: null, error: 'codAgent, whatsappNumber e hubFila são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!['uazapi', 'waba'].includes(hubFila)) {
      return new Response(
        JSON.stringify({ data: null, error: 'hubFila inválido (uazapi | waba)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const phones = brPhoneVariants(whatsappNumber);
    const whatsappNumberInsert = toBrCanonicalByDDD(whatsappNumber);
    if (phones.length === 0 || !whatsappNumberInsert) {
      return new Response(
        JSON.stringify({ data: null, error: 'whatsappNumber inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.functions.invoke('db-query', {
      body: {
        action: 'agent_and_followup_reactive',
        data: { codAgent, phones, whatsappNumberInsert, hubFila },
      },
    });

    if (error) {
      console.error('[agent_and_followup-reactive] db-query error:', error);
      return new Response(
        JSON.stringify({ data: null, error: error.message ?? 'Erro ao executar db-query' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (data?.error) {
      console.error('[agent_and_followup-reactive] db-query domain error:', data.error);
      return new Response(
        JSON.stringify({ data: null, error: data.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const row = Array.isArray(data?.data) ? data.data[0] : data?.data;
    return new Response(
      JSON.stringify({
        data: {
          codAgent,
          phones,
          whatsappNumberInsert,
          hubFila,
          ...row,
        },
        error: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[agent_and_followup-reactive] error:', err);
    return new Response(
      JSON.stringify({ data: null, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});