/**
 * copiloto-oauth — Authorization Server (OAuth 2.1 + PKCE S256) do conector
 * Copiloto da Julia. Usa a autenticação própria da Julia (bcrypt via db-query)
 * para identificar o usuário e resolver o escritório (client_id) no servidor.
 *
 * Rotas (sufixo após /functions/v1/copiloto-oauth):
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   POST /register            (Dynamic Client Registration)
 *   GET  /authorize           → redireciona para a tela de consentimento da Julia
 *   GET  /request?request_id=  → dados do pedido para a tela de consentimento
 *   POST /approve             { request_id, email, password }
 *   POST /deny                { request_id }
 *   POST /token               (authorization_code | refresh_token)
 *   POST /revoke              { token } | { token_id, email, password }
 *   POST /test-token          { email, password }  → token curto para testar as tools
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/** Domínio do app: onde vive a tela de consentimento (login do usuário). */
const APP_URL = Deno.env.get("COPILOTO_APP_URL") || "https://acesso.atendejulia.com.br";
/** Issuer OAuth = raiz do subdomínio do conector (proxy Cloudflare). */
const ISSUER = Deno.env.get("COPILOTO_ISSUER") || "https://mcp.atendejulia.com.br";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function rand(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function s256(verifier: string) {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

/** Autentica pela base própria da Julia (bcrypt no db-query). */
async function juliaLogin(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/db-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ action: "login", data: { email, password } }),
  });
  const payload = await res.json().catch(() => null);
  const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.result ?? [];
  const user = Array.isArray(rows) ? rows[0] : null;
  if (!user?.id || !user?.client_id) return null;
  return {
    userId: String(user.id),
    clientId: String(user.client_id),
    email: String(user.email ?? email),
    name: String(user.name ?? ""),
  };
}

/** Origem pública (o runtime recebe http atrás do proxy). */
function publicOrigin(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || u.host;
  return `https://${host}`;
}

function baseUrl(req: Request) {
  return `${publicOrigin(req)}/functions/v1/copiloto-oauth`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*copiloto-oauth/, "") || "/";
  const supabase = db();

  try {
    // ---------- Discovery ----------
    // O issuer é a RAIZ do subdomínio do conector (proxy), onde /authorize,
    // /token, /register e /revoke respondem na raiz — é isso que os clientes MCP
    // esperam. O proxy também serve estes documentos; aqui ficam como espelho.
    if (path.endsWith("/.well-known/oauth-authorization-server")) {
      return json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        registration_endpoint: `${ISSUER}/register`,
        revocation_endpoint: `${ISSUER}/revoke`,
        scopes_supported: ["leads:read", "julia:read"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      });
    }

    if (path.endsWith("/.well-known/oauth-protected-resource")) {
      return json({
        resource: ISSUER,
        authorization_servers: [ISSUER],
        scopes_supported: ["leads:read", "julia:read"],
        bearer_methods_supported: ["header"],
      });
    }


    // ---------- Dynamic Client Registration ----------
    if (path === "/register" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const redirectUris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
      if (!redirectUris.length) return json({ error: "invalid_redirect_uri" }, 400);

      const clientId = `cop_${rand(12)}`;
      const { error } = await supabase.from("cop_oauth_clients").insert({
        client_id: clientId,
        client_name: body.client_name || "Cliente MCP",
        redirect_uris: redirectUris,
      });
      if (error) return json({ error: "server_error", error_description: error.message }, 500);

      return json(
        {
          client_id: clientId,
          client_name: body.client_name || "Cliente MCP",
          redirect_uris: redirectUris,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        201,
      );
    }

    // ---------- Authorize ----------
    if (path === "/authorize" && req.method === "GET") {
      const p = url.searchParams;
      const clientId = p.get("client_id") || "";
      const redirectUri = p.get("redirect_uri") || "";
      const challenge = p.get("code_challenge") || "";
      const method = p.get("code_challenge_method") || "";

      if (p.get("response_type") !== "code") return json({ error: "unsupported_response_type" }, 400);
      if (!challenge || method !== "S256") return json({ error: "invalid_request", error_description: "PKCE S256 obrigatório" }, 400);

      const { data: client } = await supabase
        .from("cop_oauth_clients")
        .select("client_id, client_name, redirect_uris")
        .eq("client_id", clientId)
        .maybeSingle();
      if (!client) return json({ error: "invalid_client" }, 400);
      if (!client.redirect_uris?.includes(redirectUri)) return json({ error: "invalid_redirect_uri" }, 400);

      const requestId = rand(16);
      const { error } = await supabase.from("cop_oauth_codes").insert({
        request_id: requestId,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: method,
        scope: p.get("scope") || "leads:read",
        state: p.get("state"),
        resource: p.get("resource"),
      });
      if (error) return json({ error: "server_error", error_description: error.message }, 500);

      return new Response(null, {
        status: 302,
        headers: { ...cors, Location: `${APP_URL}/copiloto/consentimento?req=${requestId}` },
      });
    }

    // ---------- Dados do pedido (tela de consentimento) ----------
    if (path === "/request" && req.method === "GET") {
      const requestId = url.searchParams.get("request_id") || "";
      const { data: reqRow } = await supabase
        .from("cop_oauth_codes")
        .select("request_id, client_id, scope, expires_at, approved_at, used_at")
        .eq("request_id", requestId)
        .maybeSingle();
      if (!reqRow) return json({ error: "not_found" }, 404);

      const { data: client } = await supabase
        .from("cop_oauth_clients")
        .select("client_name")
        .eq("client_id", reqRow.client_id)
        .maybeSingle();

      return json({
        request_id: reqRow.request_id,
        client_name: client?.client_name || reqRow.client_id,
        scope: reqRow.scope,
        expired: new Date(reqRow.expires_at).getTime() < Date.now(),
        already_used: !!reqRow.used_at,
      });
    }

    // ---------- Aprovar / negar ----------
    if (path === "/approve" && req.method === "POST") {
      const { request_id, email, password } = await req.json().catch(() => ({}));
      const identity = await juliaLogin(String(email || ""), String(password || ""));
      if (!identity) return json({ error: "invalid_credentials" }, 401);

      const { data: reqRow } = await supabase
        .from("cop_oauth_codes")
        .select("*")
        .eq("request_id", String(request_id || ""))
        .maybeSingle();
      if (!reqRow) return json({ error: "not_found" }, 404);
      if (reqRow.used_at) return json({ error: "already_used" }, 400);
      if (new Date(reqRow.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 400);

      const code = rand(24);
      const { error } = await supabase
        .from("cop_oauth_codes")
        .update({
          code,
          approved_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(), // TTL 60s
          julia_user_id: identity.userId,
          julia_client_id: identity.clientId,
          julia_user_email: identity.email,
        })
        .eq("id", reqRow.id);
      if (error) return json({ error: "server_error", error_description: error.message }, 500);

      const redirect = new URL(reqRow.redirect_uri);
      redirect.searchParams.set("code", code);
      if (reqRow.state) redirect.searchParams.set("state", reqRow.state);
      return json({ redirect_url: redirect.toString() });
    }

    if (path === "/deny" && req.method === "POST") {
      const { request_id } = await req.json().catch(() => ({}));
      const { data: reqRow } = await supabase
        .from("cop_oauth_codes")
        .select("id, redirect_uri, state")
        .eq("request_id", String(request_id || ""))
        .maybeSingle();
      if (!reqRow) return json({ error: "not_found" }, 404);
      await supabase.from("cop_oauth_codes").update({ used_at: new Date().toISOString() }).eq("id", reqRow.id);
      const redirect = new URL(reqRow.redirect_uri);
      redirect.searchParams.set("error", "access_denied");
      if (reqRow.state) redirect.searchParams.set("state", reqRow.state);
      return json({ redirect_url: redirect.toString() });
    }

    // ---------- Token ----------
    if (path === "/token" && req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      // deno-lint-ignore no-explicit-any
      let body: any = {};
      if (ct.includes("application/json")) body = await req.json().catch(() => ({}));
      else body = Object.fromEntries(new URLSearchParams(await req.text()));

      if (body.grant_type === "refresh_token") {
        const { data: tok } = await supabase
          .from("cop_oauth_tokens")
          .select("*")
          .eq("refresh_token", String(body.refresh_token || ""))
          .is("revoked_at", null)
          .maybeSingle();
        if (!tok) return json({ error: "invalid_grant" }, 400);

        const access = rand(32);
        const refresh = rand(32);
        await supabase
          .from("cop_oauth_tokens")
          .update({
            access_token: access,
            refresh_token: refresh,
            expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
          })
          .eq("id", tok.id);

        return json({
          access_token: access,
          refresh_token: refresh,
          token_type: "Bearer",
          expires_in: 30 * 86400,
          scope: tok.scope,
        });
      }

      if (body.grant_type !== "authorization_code") return json({ error: "unsupported_grant_type" }, 400);

      const { data: codeRow } = await supabase
        .from("cop_oauth_codes")
        .select("*")
        .eq("code", String(body.code || ""))
        .maybeSingle();
      if (!codeRow || !codeRow.approved_at) return json({ error: "invalid_grant" }, 400);
      if (codeRow.used_at) return json({ error: "invalid_grant", error_description: "code já utilizado" }, 400);
      if (new Date(codeRow.expires_at).getTime() < Date.now()) return json({ error: "invalid_grant", error_description: "code expirado" }, 400);
      if (codeRow.client_id !== String(body.client_id || codeRow.client_id)) return json({ error: "invalid_client" }, 400);
      if (body.redirect_uri && body.redirect_uri !== codeRow.redirect_uri) return json({ error: "invalid_grant" }, 400);

      const verifier = String(body.code_verifier || "");
      if (!verifier || (await s256(verifier)) !== codeRow.code_challenge) {
        return json({ error: "invalid_grant", error_description: "PKCE inválido" }, 400);
      }

      await supabase.from("cop_oauth_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);

      const { data: client } = await supabase
        .from("cop_oauth_clients")
        .select("client_name")
        .eq("client_id", codeRow.client_id)
        .maybeSingle();

      const access = rand(32);
      const refresh = rand(32);
      const { error } = await supabase.from("cop_oauth_tokens").insert({
        access_token: access,
        refresh_token: refresh,
        client_id: codeRow.client_id,
        client_name: client?.client_name || codeRow.client_id,
        scope: codeRow.scope,
        julia_user_id: codeRow.julia_user_id,
        julia_client_id: codeRow.julia_client_id,
        julia_user_email: codeRow.julia_user_email,
        kind: "connector",
      });
      if (error) return json({ error: "server_error", error_description: error.message }, 500);

      return json({
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: 30 * 86400,
        scope: codeRow.scope,
      });
    }

    // ---------- Revoke ----------
    if (path === "/revoke" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.token) {
        await supabase
          .from("cop_oauth_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .or(`access_token.eq.${body.token},refresh_token.eq.${body.token}`);
        return json({ revoked: true });
      }
      if (body.token_id) {
        const identity = await juliaLogin(String(body.email || ""), String(body.password || ""));
        if (!identity) return json({ error: "invalid_credentials" }, 401);
        await supabase
          .from("cop_oauth_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", body.token_id)
          .eq("julia_client_id", identity.clientId);
        return json({ revoked: true });
      }
      return json({ error: "invalid_request" }, 400);
    }
    // Chaves de acesso estáticas foram descontinuadas: o único caminho de
    // conexão é o OAuth (authorize → consentimento → token).


    // ---------- Token curto para o simulador interno ----------
    if (path === "/test-token" && req.method === "POST") {
      const { email, password } = await req.json().catch(() => ({}));
      const identity = await juliaLogin(String(email || ""), String(password || ""));
      if (!identity) return json({ error: "invalid_credentials" }, 401);

      const access = rand(32);
      const { error } = await supabase.from("cop_oauth_tokens").insert({
        access_token: access,
        client_id: "teste-julia",
        client_name: "Teste de ferramentas (Julia)",
        scope: "leads:read",
        julia_user_id: identity.userId,
        julia_client_id: identity.clientId,
        julia_user_email: identity.email,
        kind: "test",
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      if (error) return json({ error: "server_error", error_description: error.message }, 500);

      return json({ access_token: access, expires_in: 900, scope: "leads:read" });
    }

    return json({ error: "not_found", path }, 404);
  } catch (e) {
    return json({ error: "server_error", error_description: (e as Error).message }, 500);
  }
});
