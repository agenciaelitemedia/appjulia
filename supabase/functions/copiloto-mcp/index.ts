/**
 * copiloto-mcp — Resource Server MCP (JSON-RPC / Streamable HTTP) da Julia.
 * Consumido por OpenClaw / ChatGPT / Claude via conector remoto, autenticado
 * por Bearer token emitido pela function `copiloto-oauth`.
 *
 * Somente leitura. O escritório (client_id) é sempre resolvido a partir do
 * token — nunca aceito como argumento das tools.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getToolCatalogMarkdown, getToolDefinitions, runCopilotoTool, TOOL_DOMAINS } from "../_shared/copiloto/tools/index.ts";
import {
  ANALYSIS_ATENDIMENTO,
  ANALYSIS_CONTRATO,
  ANALYSIS_DOCUMENTAL,
  ANALYSIS_PRESCRICAO,
  ANALYSIS_QUALIFICACAO,
  ANALYSIS_VIABILIDADE,
} from "../_shared/copiloto/prompts.ts";

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

const RESOURCES = [
  {
    uri: "julia://catalogo/tools",
    name: "Catálogo de ferramentas",
    description: "Todas as ferramentas de leitura do conector, agrupadas por domínio.",
    mimeType: "text/markdown",
  },
  {
    uri: "julia://escritorio/perfil",
    name: "Perfil do escritório",
    description: "Escritório autenticado no token: filas, agentes de IA e tamanho da equipe.",
    mimeType: "text/markdown",
  },
  {
    uri: "julia://politicas/uso",
    name: "Políticas de uso e sigilo",
    description: "Regras de uso dos dados: leitura apenas, isolamento por escritório, LGPD e sigilo profissional.",
    mimeType: "text/markdown",
  },
];

const PROMPTS = [
  { name: "analise_atendimento", description: "Avaliar como o atendimento foi conduzido.", command: ANALYSIS_ATENDIMENTO },
  { name: "parecer_viabilidade", description: "Parecer de viabilidade jurídica do caso.", command: ANALYSIS_VIABILIDADE },
  { name: "auditoria_documental", description: "Auditar documentos recebidos e listar o que falta.", command: ANALYSIS_DOCUMENTAL },
  { name: "qualificacao_lead", description: "Qualificar comercialmente o lead.", command: ANALYSIS_QUALIFICACAO },
  { name: "risco_prescricao", description: "Avaliar risco de prescrição/decadência.", command: ANALYSIS_PRESCRICAO },
  { name: "conferencia_contrato", description: "Conferir contrato contra o relato do cliente.", command: ANALYSIS_CONTRATO },
];

const POLICY = `# Políticas de uso — conector MCP da Julia

- Acesso **somente leitura**. Nenhuma ferramenta cria, altera ou apaga dados.
- Todo dado é filtrado pelo escritório (client_id) resolvido no token OAuth. Nenhuma ferramenta aceita client_id como argumento.
- Escopo do token: leitura de leads, atendimentos, CRM, contratos, filas, campanhas, telefonia e tickets.
- Os dados envolvem sigilo profissional e dados pessoais sensíveis (LGPD). Use apenas para apoiar o trabalho do escritório; não reproduza dados fora do contexto solicitado.
- As análises são produzidas pelo modelo do cliente MCP: a Julia entrega o dossiê e a instrução, nunca o parecer.
- O escritório pode revogar o token a qualquer momento na página do conector.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Issuer publicado é a raiz do domínio da Julia (clientes MCP resolvem
  // /authorize relativo ao issuer; o app repassa para o conector).
  // Issuer OAuth e URL pública do conector: raiz do subdomínio do proxy.
  const ISSUER = Deno.env.get("COPILOTO_ISSUER") || "https://mcp.atendejulia.com.br";
  const MCP_PUBLIC_URL = ISSUER;

  if (url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: MCP_PUBLIC_URL,
      authorization_servers: [ISSUER],
      scopes_supported: ["leads:read", "julia:read"],
      bearer_methods_supported: ["header"],
    });
  }


  const wwwAuth = {
    "WWW-Authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
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
    _agentCodes: null as string[] | null,
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
          capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
          serverInfo: { name: "julia-copiloto", version: "2.0.0" },
          instructions:
            "Conector de leitura do sistema Julia do escritório. Fluxo recomendado: julia_contatos_buscar → julia_contatos_obter_perfil → julia_chat_ler_mensagens. " +
            "Para pareceres, use as ferramentas julia_analise_* : elas devolvem o dossiê + o comando de análise, e VOCÊ escreve a análise. " +
            "Domínios disponíveis: " +
            TOOL_DOMAINS.map((d) => d.label).join("; ") +
            ". Todo acesso é somente leitura e restrito ao escritório autenticado.",
        });

      case "notifications/initialized":
        return new Response(null, { status: 202, headers: cors });

      case "ping":
        return rpc(id, {});

      case "tools/list":
        return rpc(id, { tools: getToolDefinitions() });

      case "tools/call": {
        const name = params?.name;
        try {
          const text = await runCopilotoTool(ctx, name, params?.arguments ?? {});
          return rpc(id, { content: [{ type: "text", text }] });
        } catch (e) {
          return rpc(id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
        }
      }

      case "resources/list":
        return rpc(id, { resources: RESOURCES });

      case "resources/read": {
        const uri = String(params?.uri || "");
        let text: string;
        if (uri === "julia://catalogo/tools") {
          text = `# Ferramentas do conector Julia\n\n${getToolCatalogMarkdown()}`;
        } else if (uri === "julia://politicas/uso") {
          text = POLICY;
        } else if (uri === "julia://escritorio/perfil") {
          const [{ count: queues }, { count: convs }] = await Promise.all([
            supabase.from("queues").select("id", { count: "exact", head: true }).eq("client_id", ctx.clientId),
            supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("client_id", ctx.clientId),
          ]);
          text = [
            "# Escritório autenticado",
            `Usuário do token: ${ctx.userEmail || "—"}`,
            `Filas cadastradas: ${queues ?? 0}`,
            `Atendimentos registrados: ${convs ?? 0}`,
            `Escopo do token: ${token.scope}`,
          ].join("\n");
        } else {
          return rpcError(id, -32602, `Recurso desconhecido: ${uri}`);
        }
        return rpc(id, { contents: [{ uri, mimeType: "text/markdown", text }] });
      }

      case "prompts/list":
        return rpc(id, {
          prompts: PROMPTS.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: [
              { name: "conversation_id", description: "UUID da conversa (ou use contato_id).", required: false },
              { name: "contato_id", description: "ID do contato na Julia.", required: false },
            ],
          })),
        });

      case "prompts/get": {
        const prompt = PROMPTS.find((p) => p.name === params?.name);
        if (!prompt) return rpcError(id, -32602, `Prompt desconhecido: ${params?.name}`);
        const ref = params?.arguments?.conversation_id
          ? `conversation_id ${params.arguments.conversation_id}`
          : params?.arguments?.contato_id
          ? `contato_id ${params.arguments.contato_id}`
          : "o lead indicado pelo usuário";
        return rpc(id, {
          description: prompt.description,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Use as ferramentas do conector Julia para montar o dossiê de ${ref} e depois produza a análise conforme o comando abaixo.\n\n${prompt.command}`,
              },
            },
          ],
        });
      }

      default:
        return rpcError(id, -32601, `Método não suportado: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, (e as Error).message);
  }
});
