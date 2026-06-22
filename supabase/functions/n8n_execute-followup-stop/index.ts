// ============================================
// n8n_execute → Followup Stop
// Para follow-ups ativos e limpa pré-followup
// para uma sessão WhatsApp no banco externo.
//
// Doc: supabase/functions/n8n_execute/README.md
// Memória: mem://features/n8n-execute/followup-stop
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { brPhoneVariants } from "../_shared/phone-normalize.ts";

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
    const sessionId = String(body?.sessionId ?? '').trim();

    if (!codAgent || !sessionId) {
      return new Response(
        JSON.stringify({ data: null, error: 'codAgent e sessionId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Gera as duas variantes BR (13 e 12 dígitos). Para DDDs sem o 9º dígito
    // (>= 30) o WhatsApp entrega 12, mas armazenamentos manuais usam 13. Vai
    // os dois na cláusula IN para garantir match.
    const phones = brPhoneVariants(sessionId);
    if (phones.length === 0) {
      return new Response(
        JSON.stringify({ data: null, error: 'sessionId inválido (não foi possível extrair dígitos)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.functions.invoke('db-query', {
      body: { action: 'followup_stop', data: { codAgent, phones } },
    });

    if (error) {
      console.error('[followup-stop] db-query error:', error);
      return new Response(
        JSON.stringify({ data: null, error: error.message ?? 'Erro ao executar db-query' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (data?.error) {
      console.error('[followup-stop] db-query domain error:', data.error);
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
          deleted_temp: row?.deleted_temp ?? 0,
          updated_queue: row?.updated_queue ?? 0,
          deleted_status: row?.deleted_status ?? 0,
        },
        error: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[followup-stop] error:', err);
    return new Response(
      JSON.stringify({ data: null, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});