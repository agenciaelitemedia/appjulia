/**
 * Acesso ao Postgres legado da Julia — exclusivamente via Edge Function `db-query`.
 *
 * O SQL é sempre escrito aqui (server-side) e os valores vão como parâmetros
 * ligados. Nada de SQL vindo de argumento do modelo. Todas as consultas são
 * escopadas pelos `cod_agent` do escritório do token.
 */
import type { CopilotoContext } from "./types.ts";

// deno-lint-ignore no-explicit-any
export async function legacyRaw<T = any>(
  ctx: CopilotoContext,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { data, error } = await ctx.supabase.functions.invoke("db-query", {
    body: { action: "raw", data: { query, params } },
  });
  if (error) throw new Error(`Falha ao consultar o banco legado: ${String(error)}`);
  if (data?.error) throw new Error(`Banco legado: ${data.error}`);
  return (data?.data ?? []) as T[];
}

/** cod_agent do escritório (cache por requisição). Base do escopo no legado. */
export async function agentCodes(ctx: CopilotoContext): Promise<string[]> {
  if (ctx._agentCodes) return ctx._agentCodes;
  const rows = await legacyRaw<{ cod_agent: string }>(
    ctx,
    "SELECT cod_agent::text AS cod_agent FROM agents WHERE client_id = $1::bigint",
    [ctx.clientId],
  );
  const codes = rows.map((r) => String(r.cod_agent)).filter(Boolean);
  ctx._agentCodes = codes;
  return codes;
}

/** Garante que um cod_agent informado pertence ao escritório do token. */
export async function scopedAgentCodes(ctx: CopilotoContext, requested?: string): Promise<string[]> {
  const codes = await agentCodes(ctx);
  if (!requested) return codes;
  return codes.filter((c) => c === String(requested));
}

/* --------------------------- identidade do escopo --------------------------
 * Toda resposta do MCP informa qual escritório o token resolveu. Cache curto
 * em memória para não pagar uma consulta ao legado por chamada de tool.
 * -------------------------------------------------------------------------- */

const officeCache = new Map<string, { label: string | null; ts: number }>();
const OFFICE_TTL_MS = 10 * 60_000;

/** Nome do escritório (clients.name/business_name) do token. Best-effort. */
export async function officeLabel(ctx: CopilotoContext): Promise<string | null> {
  const key = String(ctx.clientId ?? "");
  if (!key) return null;
  const cached = officeCache.get(key);
  if (cached && Date.now() - cached.ts < OFFICE_TTL_MS) return cached.label;
  let label: string | null = null;
  try {
    const rows = await legacyRaw<{ name: string | null; business_name: string | null }>(
      ctx,
      "SELECT name, business_name FROM clients WHERE id = $1::bigint LIMIT 1",
      [ctx.clientId],
    );
    label = rows[0]?.name || rows[0]?.business_name || null;
  } catch {
    label = null;
  }
  officeCache.set(key, { label, ts: Date.now() });
  return label;
}
