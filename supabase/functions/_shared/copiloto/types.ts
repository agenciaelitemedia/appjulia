/**
 * Tipos base do conector MCP da Julia.
 *
 * Regra inviolável: `clientId` (escritório) NUNCA vem de argumento de tool.
 * Ele é resolvido no servidor a partir do token OAuth (`cop_oauth_tokens`).
 */

export interface CopilotoContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  /** client_id do escritório, vindo do token OAuth. */
  clientId: string;
  userEmail?: string | null;
  /** Cache dos cod_agent do escritório (usado nas consultas ao banco legado). */
  _agentCodes?: string[] | null;
}

// deno-lint-ignore no-explicit-any
export type ToolArgs = Record<string, any>;

export interface CopilotoTool {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  inputSchema: Record<string, any>;
  /** Sempre devolve texto pronto para o modelo (Markdown/lista). */
  run: (ctx: CopilotoContext, args: ToolArgs) => Promise<string>;
}

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
