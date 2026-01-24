import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doc_token } = await req.json();
    
    if (!doc_token) {
      throw new Error('doc_token is required');
    }

    const apiToken = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!apiToken) {
      throw new Error('ZAPSIGN_API_TOKEN not configured');
    }

    console.log('Fetching document:', doc_token);

    // Chamar API ZapSign para obter detalhes do documento
    // Endpoint: GET https://api.zapsign.com.br/api/v1/docs/{doc_token}/
    const response = await fetch(
      `https://api.zapsign.com.br/api/v1/docs/${doc_token}/`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ZapSign API error:', response.status, errorData);
      throw new Error(`ZapSign API error: ${response.status}`);
    }

    const docData = await response.json();
    
    console.log('Document status:', docData.status);
    
    // Retornar URL do documento assinado (ou original se ainda nao assinado)
    // IMPORTANTE: Este link expira em 60 minutos
    const result = {
      success: true,
      signed_file: docData.signed_file || null,
      original_file: docData.original_file || null,
      status: docData.status,
      name: docData.name,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('ZapSign download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
