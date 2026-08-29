/**
 * copiloto-mcp — Resource Server MCP (JSON-RPC / Streamable HTTP) da Julia.
 * Consumido pelo ChatGPT / Claude via conector oficial, autenticado por
 * Bearer token emitido pela function `copiloto-oauth`.
 *
 * O escritório (client_id) é sempre resolvido a partir do token — nunca
 * aceito como argumento das tools.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { COPILOTO_TOOLS, runCopilotoTool } from "../_shared/copiloto/tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });

// deno-lint-ignore no-explicit-any
const rpc = (id: any, result: unknown) => json({ jsonrpc: "2.0", id, result });
// deno-lint-ignore no-explicit-any
const rpcError = (id: any, code: number, message: string) => json({ jsonrpc: "2.0", id, error: { code, message } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: `${url.origin}/functions/v1/copiloto-mcp`,
      authorization_servers: [`${url.origin}/functions/v1/copiloto-oauth`],
      scopes_supported: ["leads:read"],
      bearer_methods_supported: ["header"],
    });
  }

  const wwwAuth = {
    "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/functions/v1/copiloto-oauth/.well-known/oauth-protected-resource"`,
  };

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return json({ error: "unauthorized" }, 401, wwwAuth);

  const { data: token } = await supabase
    .from("cop_oauth_tokens")
    .select("id, julia_client_id, julia_user_email, scope, expires_at, revoked_at")
    .eq("access_token", bearer)
    .maybeSingle();

  if (!token || token.revoked_at || new Date(token.expires_at).getTime() < Date.now()) {
    return json({ error: "invalid_token" }, 401, wwwAuth);
  }

  await supabase.from("cop_oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);

  const ctx = {
    supabase,
    clientId: String(token.julia_client_id),
    userEmail: token.julia_user_email,
  };

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => null);
  if (!body) return rpcError(null, -32700, "Parse error");

  const { id, method, params } = body;

  try {
    switch (method) {
      case "initialize":
        return rpc(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "julia-copiloto", version: "1.0.0" },
          instructions:
            "Ferramentas do escritório na Julia. Use buscar_lead para localizar o lead, obter_historico para ler a conversa e analisar_atendimento para a análise jurídica completa.",
        });

      case "notifications/initialized":
        return new Response(null, { status: 202, headers: cors });

      case "ping":
        return rpc(id, {});

      case "tools/list":
        return rpc(id, { tools: COPILOTO_TOOLS });

      case "tools/call": {
        const name = params?.name;
        try {
          const text = await runCopilotoTool(ctx, name, params?.arguments ?? {});
          return rpc(id, { content: [{ type: "text", text }] });
        } catch (e) {
          return rpc(id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
        }
      }

      default:
        return rpcError(id, -32601, `Método não suportado: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, (e as Error).message);
  }
});
