/**
 * Registry e dispatcher de tools do conector MCP da Julia.
 *
 * Regra inviolável: `clientId` vem do token OAuth (cop_oauth_tokens).
 * Nenhuma tool aceita client_id, SQL ou nome de tabela como argumento.
 *
 * O dispatcher é a camada transversal do backlog: valida escopo, injeta
 * request_id, aplica rate limit, mede latência e devolve sempre um envelope
 * (JSON estruturado + resumo em texto) ou um erro estruturado.
 */
import { CopilotoError, errorEnvelope, requestId as newRequestId, SCHEMA_VERSION, type ToolOutput } from "../envelope.ts";
import {
  SCOPE_LEGACY_READ,
  SCOPE_READ,
  type CopilotoContext,
  type CopilotoTool,
  type ToolArgs,
} from "../types.ts";
import { analiseTools } from "./analise.ts";
import { chatTools } from "./chat.ts";
import { contatoTools } from "./contatos.ts";
import { contratoTools } from "./contratos.ts";
import { crmTools } from "./crm.ts";
import { dossieTools } from "./dossie.ts";
import { escritaTools } from "./escrita.ts";
import { leadTools } from "./leads.ts";
import { metaTools, registerCatalogSource } from "./meta.ts";
import { metricaTools } from "./metricas.ts";
import { operacaoTools } from "./operacao.ts";

export const TOOL_DOMAINS: { domain: string; label: string; tools: CopilotoTool[] }[] = [
  { domain: "meta", label: "Conector: capacidades e saúde", tools: metaTools },
  { domain: "leads", label: "Coorte de leads e follow-ups", tools: leadTools },
  { domain: "contatos", label: "Contatos e leads", tools: contatoTools },
  { domain: "chat", label: "Atendimento e mensagens", tools: chatTools },
  { domain: "crm", label: "CRM de Leads e CRM Builder", tools: crmTools },
  { domain: "contratos", label: "Contratos ZapSign", tools: contratoTools },
  { domain: "operacao", label: "Filas, equipe, campanhas, telefonia e tickets", tools: operacaoTools },
  { domain: "dossie", label: "Documentos, contratos (timeline) e presença", tools: dossieTools },
  { domain: "metricas", label: "Métricas de funil, SLA e qualidade", tools: metricaTools },
  { domain: "analise", label: "Análises jurídicas e de atendimento", tools: analiseTools },
  { domain: "escrita", label: "Escrita controlada (dry-run, aprovação e auditoria)", tools: escritaTools },
];

export const ALL_TOOLS: CopilotoTool[] = TOOL_DOMAINS.flatMap((d) => d.tools);

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

registerCatalogSource(() => ALL_TOOLS);

/** Escopos que a tool aceita. Leitura aceita o escopo legado `leads:read`. */
function allowedScopes(tool: CopilotoTool): string[] {
  const required = tool.requiredScope ?? SCOPE_READ;
  return required === SCOPE_READ ? [SCOPE_READ, SCOPE_LEGACY_READ] : [required];
}

/** Definições no formato do protocolo MCP (sem o `run`). */
export function getToolDefinitions() {
  return ALL_TOOLS.map((t) => {
    const write = t.mode === "write";
    return {
      name: t.name,
      description:
        `${t.description}` +
        (write ? " [ESCRITA — simula por padrão (dry_run); exige idempotency_key e approved_by para aplicar]" : "") +
        (t.deprecated ? ` [DEPRECADA — use ${t.replacedBy || "a substituta indicada"}]` : ""),
      inputSchema: t.inputSchema,
      annotations: {
        readOnlyHint: !write,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: `${t.name} v${t.version ?? "1.0.0"} · ${t.mode ?? "read"} · ${t.requiredScope ?? SCOPE_READ}`,
      },
    };
  });
}

/** Catálogo legível, agrupado por domínio (usado em resources e na UI). */
export function getToolCatalogMarkdown(): string {
  return TOOL_DOMAINS.map(
    (d) =>
      `## ${d.label}\n${d.tools
        .map(
          (t) =>
            `- **${t.name}** \`v${t.version ?? "1.0.0"}\` (${t.mode ?? "read"}, escopo ${t.requiredScope ?? SCOPE_READ}) — ${t.description}`,
        )
        .join("\n")}`,
  ).join("\n\n");
}

/* ------------------------------- rate limit ------------------------------- */

const WINDOW_MS = 60_000;
const LIMIT_READ = 120;
const LIMIT_WRITE = 20;
const hits = new Map<string, number[]>();

function rateLimit(key: string, limit: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    throw new CopilotoError("RATE_LIMITED", `Limite de ${limit} chamadas por minuto atingido para esta operação.`, {
      retryable: true,
      details: { window_seconds: 60, limit },
    });
  }
  list.push(now);
  hits.set(key, list);
}

/* -------------------------------- dispatch -------------------------------- */

export interface DispatchResult {
  text: string;
  // deno-lint-ignore no-explicit-any
  structuredContent: Record<string, any>;
  isError: boolean;
}

export async function dispatchCopilotoTool(ctx: CopilotoContext, name: string, args: ToolArgs): Promise<DispatchResult> {
  const rid = newRequestId();
  const started = Date.now();
  const tool = BY_NAME.get(name);
  const callCtx: CopilotoContext = { ...ctx, requestId: rid };

  try {
    if (!tool) {
      throw new CopilotoError("INVALID_INPUT", `Ferramenta desconhecida: ${name}. Use tools/list ou mcp_capabilities.`);
    }

    const granted = (ctx.scopes || []).map((s) => s.trim());
    const accepted = allowedScopes(tool);
    if (!granted.some((s) => accepted.includes(s))) {
      throw new CopilotoError("PERMISSION_DENIED", `Esta ferramenta exige o escopo ${tool.requiredScope ?? SCOPE_READ}.`, {
        details: { required_scope: tool.requiredScope ?? SCOPE_READ, granted_scopes: granted },
      });
    }

    if (args && typeof args === "object" && !Array.isArray(args)) {
      const allowed = Object.keys(tool.inputSchema?.properties ?? {});
      const unknown = Object.keys(args).filter((k) => !allowed.includes(k));
      if (unknown.length && tool.inputSchema?.additionalProperties === false) {
        throw new CopilotoError("INVALID_INPUT", `Parâmetros não reconhecidos: ${unknown.join(", ")}.`, {
          details: { accepted_parameters: allowed },
        });
      }
      for (const req of (tool.inputSchema?.required ?? []) as string[]) {
        if (args[req] === undefined || args[req] === null || args[req] === "") {
          throw new CopilotoError("INVALID_INPUT", `Parâmetro obrigatório ausente: ${req}.`);
        }
      }
    }

    rateLimit(`${ctx.tokenId ?? ctx.clientId}:${tool.mode === "write" ? "write" : "read"}`, tool.mode === "write" ? LIMIT_WRITE : LIMIT_READ);

    const raw = await tool.run(callCtx, args || {});
    const output: ToolOutput =
      typeof raw === "string"
        ? {
            text: raw,
            json: {
              summary: raw,
              tool: tool.name,
              tool_version: tool.version ?? "1.0.0",
              schema_version: SCHEMA_VERSION,
              generated_at: new Date().toISOString(),
              request_id: rid,
              legacy_text_output: true,
            },
          }
        : raw;

    return {
      text: output.text,
      structuredContent: { ...output.json, latency_ms: Date.now() - started },
      isError: false,
    };
  } catch (e) {
    const envelope = errorEnvelope(e, rid, name);
    return {
      text: `Erro ${envelope.error.code}: ${envelope.error.message}${envelope.error.dependency ? ` (dependência: ${envelope.error.dependency})` : ""}`,
      structuredContent: { ...envelope, latency_ms: Date.now() - started },
      isError: true,
    };
  }
}

/** Compatibilidade: devolve apenas o texto. */
export async function runCopilotoTool(ctx: CopilotoContext, name: string, args: ToolArgs): Promise<string> {
  const res = await dispatchCopilotoTool(ctx, name, args);
  if (res.isError) throw new Error(res.text);
  return res.text;
}
