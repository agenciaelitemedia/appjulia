import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "npm:jszip@3.10.1";

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

    // Build the list of files to deliver: main doc + extra_docs
    const sanitize = (s: string) =>
      (s || '').replace(/[^a-zA-Z0-9_\-. ]/g, '').substring(0, 100) || 'contrato';

    const pickUrl = (d: any): string | null => {
      if (file === 'signed') return d?.signed_file || d?.original_file || null;
      return d?.original_file || null;
    };

    const safeFileName = sanitize(docName);
    const extras: any[] = Array.isArray(docData.extra_docs) ? docData.extra_docs : [];

    const entries: { name: string; url: string }[] = [];
    const mainUrl = pickUrl(docData);
    if (mainUrl) entries.push({ name: sanitize(docData.name || 'contrato'), url: mainUrl });
    extras.forEach((ed, idx) => {
      const u = pickUrl(ed);
      if (u) entries.push({ name: sanitize(ed?.name || `anexo-${idx + 1}`), url: u });
    });

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: file === 'signed'
            ? 'Documento ainda não foi assinado ou não possui arquivo disponível'
            : 'Arquivo original não disponível',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single file → stream the PDF directly (preserves current behavior)
    if (entries.length === 1) {
      const only = entries[0];
      console.log(`Fetching single file from: ${only.url.substring(0, 60)}...`);
      const fileResponse = await fetch(only.url);
      if (!fileResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao baixar arquivo: ${fileResponse.status}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const contentType = fileResponse.headers.get('Content-Type') || 'application/pdf';
      return new Response(fileResponse.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
        },
      });
    }

    // Multiple files (main + extras) → build a ZIP
    console.log(`Bundling ${entries.length} files (1 main + ${entries.length - 1} extras) into a ZIP`);
    const zip = new JSZip();
    const used = new Map<string, number>();

    const downloads = await Promise.all(
      entries.map(async (e, idx) => {
        const r = await fetch(e.url);
        if (!r.ok) throw new Error(`Falha ao baixar "${e.name}" (HTTP ${r.status})`);
        const buf = new Uint8Array(await r.arrayBuffer());
        let base = `${String(idx + 1).padStart(2, '0')} - ${e.name}`;
        if (!/\.pdf$/i.test(base)) base += '.pdf';
        const count = (used.get(base) || 0) + 1;
        used.set(base, count);
        const finalName = count === 1 ? base : base.replace(/\.pdf$/i, ` (${count}).pdf`);
        return { name: finalName, data: buf };
      })
    );

    for (const f of downloads) zip.file(f.name, f.data);
    const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    console.log(`ZIP generated: ${zipBuffer.byteLength} bytes`);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFileName}.zip"`,
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
