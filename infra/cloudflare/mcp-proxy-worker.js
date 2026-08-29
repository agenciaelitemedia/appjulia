/**
 * Proxy do conector MCP da Julia — publica o MCP em https://mcp.atendejulia.com.br
 * sem expor o host do backend.
 *
 * Como publicar (Cloudflare):
 * 1. Workers & Pages → Create Worker → cole este arquivo.
 * 2. Settings → Variables → adicione MCP_ORIGIN com a URL completa da function MCP
 *    (ex.: https://<ref>.supabase.co/functions/v1/copiloto-mcp). Guarde como secret.
 * 3. Em atendejulia.com.br → DNS: registro CNAME `mcp` (proxied) e, no Worker,
 *    Settings → Domains & Routes → Add custom domain → mcp.atendejulia.com.br.
 * 4. Teste: POST https://mcp.atendejulia.com.br com um JSON-RPC deve responder 401
 *    (sem Bearer) e GET /.well-known/oauth-protected-resource deve retornar o documento.
 *
 * O Worker repassa método, cabeçalhos (inclusive Authorization) e corpo, e devolve
 * a resposta como recebida — incluindo streaming SSE.
 */
export default {
  async fetch(request, env) {
    const target = env.MCP_ORIGIN;
    if (!target) {
      return new Response(JSON.stringify({ error: 'MCP_ORIGIN não configurado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const incoming = new URL(request.url);
    const base = new URL(target);
    // Preserva subcaminhos (ex.: /.well-known/oauth-protected-resource) e a query.
    const upstream = new URL(base.pathname.replace(/\/$/, '') + incoming.pathname, base.origin);
    upstream.search = incoming.search;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-session-id',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', incoming.host);

    const response = await fetch(upstream.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    const out = new Headers(response.headers);
    out.set('Access-Control-Allow-Origin', '*');
    out.set('Access-Control-Expose-Headers', 'mcp-session-id, www-authenticate');
    return new Response(response.body, { status: response.status, headers: out });
  },
};
