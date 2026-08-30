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

/* ------------------------------ telemetria -------------------------------- */

const DOMAIN_BY_TOOL = new Map<string, string>(
  TOOL_DOMAINS.flatMap((d) => d.tools.map((t) => [t.name, d.domain] as [string, string])),
);

interface TelemetryRow {
  request_id: string;
  tool_name: string;
  domain: string | null;
  tool_version: string | null;
  mode: string;
  client_id: string | null;
  token_id: string | null;
  status: "ok" | "error";
  error_code: string | null;
  retryable: boolean;
  dependency: string | null;
  latency_ms: number;
  dry_run: boolean | null;
  coverage_complete: boolean | null;
  coverage_warnings: number;
  result_count: number | null;
  arg_keys: string[];
  arg_summary: Record<string, unknown> | null;
}

/**
 * Resumo redigido dos argumentos: mantém IDs, limites, cursores, datas e flags;
 * omite qualquer texto livre/conteúdo e trunca valores longos.
 * Nunca grava mensagem de lead, mídia, token ou credencial.
 */
const REDACT_KEY = /(mensagem|message|texto|text|body|conteudo|content|caption|prompt|observacao|nota|note|midia|media|url|token|senha|password|secret|key|arquivo|file|base64)/i;
const MAX_VALUE_LEN = 64;
const MAX_SUMMARY_KEYS = 20;

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.length > MAX_VALUE_LEN) return `${value.slice(0, MAX_VALUE_LEN)}…(${value.length})`;
    return value;
  }
  if (Array.isArray(value)) {
    return { tipo: "array", itens: value.length, amostra: value.slice(0, 3).map((v) => redactValue(v)) };
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return { tipo: "objeto", chaves: keys.slice(0, 10) };
  }
  return "[omitido]";
}

function summarizeArgs(args: ToolArgs): Record<string, unknown> | null {
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args).slice(0, MAX_SUMMARY_KEYS)) {
    out[key] = REDACT_KEY.test(key) ? "[omitido]" : redactValue(value);
  }
  return out;
}


/**
 * Grava a telemetria da chamada (fire-and-forget) e emite um log estruturado
 * em linha única. Nunca carrega conteúdo de lead, argumento cru ou token.
 */
function recordCall(ctx: CopilotoContext, row: TelemetryRow) {
  try {
    console.log(JSON.stringify({ evt: "mcp_tool_call", ...row, token_id: row.token_id ? "set" : null }));
  } catch {
    // log nunca derruba a tool
  }
  try {
    const p = ctx.supabase?.from("cop_tool_calls").insert(row);
    if (p && typeof p.then === "function") {
      p.then((res: { error?: unknown }) => {
        if (res?.error) console.log(JSON.stringify({ evt: "mcp_tool_call_log_failed", request_id: row.request_id }));
      }).catch(() => {});
    }
  } catch {
    // telemetria é best-effort
  }
}

// deno-lint-ignore no-explicit-any
function resultCountOf(json: Record<string, any>): number | null {
  if (!json || typeof json !== "object") return null;
  if (typeof json.total === "number") return json.total;
  if (typeof json.count === "number") return json.count;
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) return value.length;
  }
  return null;
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
  const argKeys = args && typeof args === "object" && !Array.isArray(args) ? Object.keys(args) : [];

  const baseRow = {
    request_id: rid,
    tool_name: name,
    domain: DOMAIN_BY_TOOL.get(name) ?? null,
    tool_version: tool?.version ?? null,
    mode: tool?.mode ?? "read",
    client_id: ctx.clientId ?? null,
    token_id: ctx.tokenId ?? null,
    arg_keys: argKeys,
  };

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

    const latency = Date.now() - started;
    const cov = output.json?.coverage;
    recordCall(ctx, {
      ...baseRow,
      status: "ok",
      error_code: null,
      retryable: false,
      dependency: null,
      latency_ms: latency,
      dry_run: typeof output.json?.dry_run === "boolean" ? output.json.dry_run : null,
      coverage_complete: typeof cov?.complete === "boolean" ? cov.complete : null,
      coverage_warnings: Array.isArray(cov?.warnings) ? cov.warnings.length : 0,
      result_count: resultCountOf(output.json),
    });

    return {
      text: output.text,
      structuredContent: { ...output.json, latency_ms: latency },
      isError: false,
    };
  } catch (e) {
    const envelope = errorEnvelope(e, rid, name);
    const latency = Date.now() - started;
    recordCall(ctx, {
      ...baseRow,
      status: "error",
      error_code: envelope.error.code ?? "INTERNAL",
      retryable: Boolean(envelope.error.retryable),
      dependency: envelope.error.dependency ?? null,
      latency_ms: latency,
      dry_run: null,
      coverage_complete: false,
      coverage_warnings: 0,
      result_count: null,
    });
    return {
      text: `Erro ${envelope.error.code}: ${envelope.error.message}${envelope.error.dependency ? ` (dependência: ${envelope.error.dependency})` : ""}`,
      structuredContent: { ...envelope, latency_ms: latency },
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
