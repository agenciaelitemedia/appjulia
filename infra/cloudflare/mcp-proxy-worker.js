/**
 * Cloudflare Worker — conector MCP da Julia em https://mcp.atendejulia.com.br
 *
 * Existe porque clientes MCP (OpenClaw, ChatGPT, Claude) resolvem os endpoints
 * OAuth relativos à RAIZ do issuer, e nem a hospedagem do app (que bloqueia
 * /.well-known/) nem a raiz do backend atendem isso. Este Worker publica tudo na
 * raiz de um subdomínio nosso e repassa para as edge functions.
 *
 * ┌─ Rotas ────────────────────────────────────────────────────────────────────┐
 * │ GET  /.well-known/oauth-authorization-server → discovery (servido aqui)    │
 * │ GET  /.well-known/oauth-protected-resource   → discovery do recurso        │
 * │ GET  /authorize                              → copiloto-oauth/authorize    │
 * │ POST /token /register /revoke                → copiloto-oauth/<rota>       │
 * │ *    /  (JSON-RPC, SSE)                      → copiloto-mcp                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * PUBLICAÇÃO (painel Cloudflare da conta de atendejulia.com.br):
 *   1. Workers & Pages → Create → Worker → colar este arquivo → Deploy.
 *   2. Settings → Variables → adicionar BACKEND_FUNCTIONS_BASE =
 *      https://<projeto>.supabase.co/functions/v1
 *   3. Settings → Domains & Routes → Add → Custom domain →
 *      mcp.atendejulia.com.br  (o Cloudflare cria o DNS e o certificado)
 *   4. Validar:
 *      curl -s https://mcp.atendejulia.com.br/.well-known/oauth-authorization-server
 *      curl -i -X POST https://mcp.atendejulia.com.br -d '{}'   → 401
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, accept, mcp-protocol-version, x-client-info, apikey',
  'Access-Control-Expose-Headers': 'www-authenticate, mcp-session-id',
  'Access-Control-Max-Age': '86400',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const issuer = env.ISSUER || `https://${url.host}`;
    const base = (env.BACKEND_FUNCTIONS_BASE || '').replace(/\/+$/, '');

    if (!base) {
      return json({ error: 'BACKEND_FUNCTIONS_BASE não configurado no Worker.' }, 500);
    }

    const oauth = `${base}/copiloto-oauth`;
    const mcp = `${base}/copiloto-mcp`;

    // ---------- Discovery servido na raiz do subdomínio ----------
    if (path === '/.well-known/oauth-authorization-server') {
      return json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        revocation_endpoint: `${issuer}/revoke`,
        scopes_supported: ['leads:read', 'julia:read'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      });
    }

    if (path === '/.well-known/oauth-protected-resource') {
      return json({
        resource: issuer,
        authorization_servers: [issuer],
        scopes_supported: ['leads:read', 'julia:read'],
        bearer_methods_supported: ['header'],
      });
    }

    // ---------- Rotas OAuth ----------
    const OAUTH_ROUTES = ['/authorize', '/token', '/register', '/revoke', '/request', '/approve', '/deny'];
    const target = OAUTH_ROUTES.includes(path)
      ? `${oauth}${path}${url.search}`
      : `${mcp}${url.search}`;

    // Repassa método, corpo e cabeçalhos relevantes; nada é reescrito.
    const headers = new Headers();
    for (const name of ['authorization', 'content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('x-forwarded-host', url.host);

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);
    out.delete('content-encoding');
    out.delete('content-length');

    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
