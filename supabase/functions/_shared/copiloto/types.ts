/**
 * Tipos base do conector MCP da Julia.
 *
 * Regra inviolável: `clientId` (escritório) NUNCA vem de argumento de tool.
 * Ele é resolvido no servidor a partir do token OAuth (`cop_oauth_tokens`).
 */
import type { ToolOutput } from "./envelope.ts";

export interface CopilotoContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  /** client_id do escritório, vindo do token OAuth. */
  clientId: string;
  userEmail?: string | null;
  /** Escopos concedidos ao token (ex.: ["julia:read", "julia:write.crm"]). */
  scopes?: string[];
  /** ID do token OAuth — usado em rate limit e auditoria de escrita. */
  tokenId?: string | null;
  /** request_id da chamada em curso (injetado pelo dispatcher). */
  requestId?: string;
  /** Cache dos cod_agent do escritório (usado nas consultas ao banco legado). */
  _agentCodes?: string[] | null;
}

// deno-lint-ignore no-explicit-any
export type ToolArgs = Record<string, any>;

export type ToolMode = "read" | "write";

export interface CopilotoTool {
  name: string;
  /** Versão semântica da tool (aparece em mcp_capabilities). */
  version?: string;
  mode?: ToolMode;
  /** Escopo OAuth exigido. Padrão: leitura. */
  requiredScope?: string;
  deprecated?: boolean;
  replacedBy?: string;
  removalDate?: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  inputSchema: Record<string, any>;
  /** Devolve texto pronto (legado) ou o envelope `{ json, text }`. */
  run: (ctx: CopilotoContext, args: ToolArgs) => Promise<string | ToolOutput>;
}

export const SCOPE_READ = "julia:read";
export const SCOPE_WRITE_CRM = "julia:write.crm";
export const SCOPE_WRITE_MESSAGES = "julia:write.messages";
/** Escopo legado, equivalente a leitura. */
export const SCOPE_LEGACY_READ = "leads:read";

export const MAX_MESSAGES = 100;
export const MAX_ROWS = 200;

export function num(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Corta texto muito longo para não estourar a janela do modelo. */
export function clip(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...conteúdo truncado em ${max} caracteres]`;
}

export function fmtDate(ts: unknown): string {
  if (!ts) return "—";
  const d = new Date(String(ts));
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

/** Renderiza uma lista de registros como bullets `campo: valor`. */
export function bullets(rows: Record<string, unknown>[], fields: [string, string][]): string {
  return rows
    .map((row) => {
      const parts = fields
        .map(([key, label]) => {
          const v = row[key];
          if (v === null || v === undefined || v === "") return null;
          return `${label}: ${v}`;
        })
        .filter(Boolean);
      return `- ${parts.join(" · ")}`;
    })
    .join("\n");
}

export function empty(msg: string): string {
  return msg;
}
