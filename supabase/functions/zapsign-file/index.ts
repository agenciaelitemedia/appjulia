import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doc_token, file = 'signed' } = await req.json();

    if (!doc_token || typeof doc_token !== 'string' || doc_token.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: 'doc_token é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ZAPSIGN_API_TOKEN = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!ZAPSIGN_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'ZAPSIGN_API_TOKEN não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try fetching document details
    let docData: any = null;
    let docName = 'contrato';

    // First try as document token
    const docResponse = await fetch(
      `https://api.zapsign.com.br/api/v1/docs/${doc_token}/`,
      {
        headers: {
          'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}`,
        },
      }
    );

    if (docResponse.ok) {
      docData = await docResponse.json();
      docName = docData.name || 'contrato';
    } else if (docResponse.status === 404) {
      // Try as signer token
      const signerResponse = await fetch(
        `https://api.zapsign.com.br/api/v1/signers/${doc_token}/`,
        {
          headers: {
            'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}`,
          },
        }
      );

      if (signerResponse.ok) {
        const signerData = await signerResponse.json();
        if (signerData.document?.token) {
          const innerDocResponse = await fetch(
            `https://api.zapsign.com.br/api/v1/docs/${signerData.document.token}/`,
            {
              headers: {
                'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}`,
              },
            }
          );
          if (innerDocResponse.ok) {
            docData = await innerDocResponse.json();
            docName = docData.name || 'contrato';
          }
        }
      }
    }

    if (!docData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Documento não encontrado no ZapSign' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Select the appropriate file URL
    let fileUrl: string | null = null;
    
    if (file === 'signed') {
      fileUrl = docData.signed_file || docData.original_file;
      if (!docData.signed_file && docData.original_file) {
        console.log('signed_file not available, falling back to original_file');
      }
    } else {
      fileUrl = docData.original_file;
    }

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: file === 'signed' 
            ? 'Documento ainda não foi assinado ou não possui arquivo disponível'
            : 'Arquivo original não disponível'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the actual file from S3 and stream it
    console.log(`Fetching file from: ${fileUrl.substring(0, 50)}...`);
    
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao baixar arquivo: ${fileResponse.status}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content type from S3 response, default to PDF
    const contentType = fileResponse.headers.get('Content-Type') || 'application/pdf';
    
    // Sanitize filename
    const safeFileName = docName
      .replace(/[^a-zA-Z0-9_\-. ]/g, '')
      .substring(0, 100) || 'contrato';
    
    // Stream the response back
    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error in zapsign-file:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno ao processar arquivo' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
