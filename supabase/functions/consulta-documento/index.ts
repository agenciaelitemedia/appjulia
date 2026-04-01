import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document } = await req.json();
    const digits = document.replace(/\D/g, '');

    if (!digits || (digits.length !== 11 && digits.length !== 14)) {
      return new Response(
        JSON.stringify({ error: 'Documento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { name?: string; email?: string; phone?: string; address?: string } = {};

    if (digits.length === 14) {
      // CNPJ - consulta ReceitaWS (API pública gratuita)
      try {
        const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.status !== 'ERROR') {
            const parts = [
              data.logradouro,
              data.numero,
              data.complemento,
              data.bairro,
              data.municipio,
              data.uf,
              data.cep?.replace(/[.\-]/g, ''),
            ].filter(Boolean);

            result = {
              name: data.nome || data.fantasia || undefined,
              email: data.email && data.email !== '' ? data.email.toLowerCase() : undefined,
              phone: data.telefone ? data.telefone.replace(/[^\d]/g, '').slice(0, 11) : undefined,
              address: parts.length > 0 ? parts.join(', ') : undefined,
            };
          }
        }
      } catch (e) {
        console.error('ReceitaWS error:', e);
      }
    } else {
      // CPF - consulta BrasilAPI (API pública gratuita)
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cpf/v1/${digits}`);
        if (resp.ok) {
          const data = await resp.json();
          result = {
            name: data.nome || undefined,
          };
        }
      } catch (e) {
        console.error('BrasilAPI CPF error:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao consultar documento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
