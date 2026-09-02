/**
 * Camada compartilhada das tools MCP da Julia.
 *
 * Regras:
 * - Nenhuma tool aceita client_id como argumento: o escritório é resolvido
 *   sempre a partir do e-mail verificado no token OAuth.
 * - Somente leitura.
 * - Import-safe: nada de leitura de env ou I/O em nível de módulo.
 */
import { createClient } from "@supabase/supabase-js";
import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function projectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new ToolError("SUPABASE_URL não configurada no runtime.");
  return url;
}

function publishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // dicionário malformado: cai nos nomes legados
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new ToolError("Chave pública do backend não configurada no runtime.");
}

function serviceKey(): string | undefined {
  return configuredEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
}

/** Cliente de leitura server-side (service role quando disponível). */
export function backend() {
  const key = serviceKey() ?? publishableKey();
  return createClient(projectUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Chamada ao banco legado, exclusivamente via a edge function `db-query`. */
export async function legacyQuery<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T[]> {
  const key = serviceKey() ?? publishableKey();
  const res = await fetch(`${projectUrl()}/functions/v1/db-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ action, data }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ToolError(`Consulta ao banco da Julia falhou (${action}): ${payload?.error ?? res.status}`);
  }
  const rows = payload?.data ?? payload?.result ?? payload;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export interface JuliaIdentity {
  email: string;
  userId: string;
  userName: string | null;
  role: string | null;
  clientId: string;
}

/**
 * Resolve o escritório (client_id) a partir do e-mail do token OAuth.
 * Só libera dados quando o e-mail existe como usuário da Julia.
 */
export async function resolveIdentity(ctx: ToolContext): Promise<JuliaIdentity> {
  if (!ctx.isAuthenticated()) {
    throw new ToolError("Conexão não autenticada. Refaça o login do conector.");
  }
  const email = (ctx.getUserEmail() ?? "").trim().toLowerCase();
  if (!email) {
    throw new ToolError("O token não traz e-mail; não é possível identificar o usuário da Julia.");
  }

  const users = await legacyQuery<{ id: string; name: string | null; email: string; role: string | null }>(
    "search_users",
    { term: email },
  );
  const user = users.find((u) => (u.email ?? "").trim().toLowerCase() === email);
  if (!user) {
    throw new ToolError(
      `O e-mail ${email} não corresponde a nenhum usuário da Julia. Conecte-se com o mesmo e-mail da sua conta na Julia.`,
    );
  }

  const rows = await legacyQuery<{ client_id: string | null }>("get_effective_client_id", { userId: user.id });
  const clientId = rows[0]?.client_id;
  if (!clientId) {
    throw new ToolError("Seu usuário não está vinculado a um escritório. Fale com o administrador da conta.");
  }

  return { email, userId: String(user.id), userName: user.name, role: user.role, clientId: String(clientId) };
}

/** Cabeçalho padrão das respostas, deixando explícito o escritório consultado. */
export function header(identity: JuliaIdentity, title: string): string {
  return `# ${title}\nEscritório (client_id): ${identity.clientId} · usuário: ${identity.email}`;
}

export function fmtDate(ts: unknown): string {
  if (!ts) return "—";
  const d = new Date(String(ts));
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

/** Só dígitos, para casar telefone com/sem DDI. */
export function digits(value: string): string {
  return (value || "").replace(/\D+/g, "");
}

export function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}
