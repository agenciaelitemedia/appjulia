// ============================================
// X-Julia — guarda de identidade das funções de painel
//
// A autenticação do produto é própria (bcrypt no db-query, sem Supabase Auth),
// então ativar verify_jwt não resolve. A guarda:
//   1. exige os headers de sessão do app (x-app-user-id + x-app-user-email);
//   2. resolve user -> client_id no SERVIDOR (Postgres externo, via db-query);
//   3. recusa usuário inativo, inexistente ou com e-mail divergente;
//   4. devolve o client_id resolvido — o client_id do corpo passa a ser ignorado.
//
// Funções internas (server-to-server) usam requireInternalSecret().
// ============================================

export interface XJIdentity {
  userId: string;
  email: string;
  role: string;
  clientId: string;
  isAdmin: boolean;
}

export interface XJGuardFailure {
  error: string;
  status: number;
}

export const XJ_GUARD_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-app-user-id, x-app-user-email, x-xj-internal-secret";

function isFailure(v: XJIdentity | XJGuardFailure): v is XJGuardFailure {
  return (v as XJGuardFailure).error !== undefined;
}

export function xjGuardFailed(v: XJIdentity | XJGuardFailure): v is XJGuardFailure {
  return isFailure(v);
}

/** Consulta o usuário no Postgres externo através do db-query (service role). */
async function fetchAppUser(userId: string): Promise<Record<string, unknown> | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  const resp = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      action: "raw",
      data: {
        query: `SELECT u.id, u.email, u.role, u.is_active,
                       COALESCE(u.client_id, parent.client_id) AS client_id
                  FROM users u
                  LEFT JOIN users parent ON parent.id = u.user_id
                 WHERE u.id = $1::bigint
                 LIMIT 1`,
        params: [String(userId)],
      },
    }),
  });
  if (!resp.ok) return null;
  const out = await resp.json().catch(() => null);
  const rows = Array.isArray(out?.data) ? out.data : [];
  return rows[0] ?? null;
}

/**
 * Identifica o chamador de uma função de painel.
 * Retorna { error, status } quando a chamada deve ser recusada.
 */
export async function requireAppIdentity(req: Request): Promise<XJIdentity | XJGuardFailure> {
  const userId = (req.headers.get("x-app-user-id") ?? "").trim();
  const email = (req.headers.get("x-app-user-email") ?? "").trim().toLowerCase();

  if (!userId || !/^\d+$/.test(userId)) {
    return { error: "sessão do aplicativo ausente", status: 401 };
  }

  let row: Record<string, unknown> | null = null;
  try {
    row = await fetchAppUser(userId);
  } catch (_err) {
    return { error: "não foi possível validar a sessão", status: 401 };
  }

  if (!row) return { error: "sessão inválida", status: 401 };
  if (row.is_active === false) return { error: "usuário inativo", status: 403 };

  const dbEmail = String(row.email ?? "").trim().toLowerCase();
  if (email && dbEmail && email !== dbEmail) {
    return { error: "sessão inválida", status: 401 };
  }

  const clientId = String(row.client_id ?? "").trim();
  if (!clientId) return { error: "escritório não resolvido para este usuário", status: 403 };

  const role = String(row.role ?? "user");
  return { userId: String(row.id), email: dbEmail, role, clientId, isAdmin: role === "admin" };
}

/**
 * Confere o segredo compartilhado das chamadas internas (webhook -> motor,
 * worker -> motor). Sem o segredo configurado, aceita a chave de serviço.
 */
export function requireInternalSecret(req: Request): XJGuardFailure | null {
  const expected = (Deno.env.get("XJ_INTERNAL_SECRET") ?? "").trim();
  const provided = (req.headers.get("x-xj-internal-secret") ?? "").trim();
  if (expected && provided === expected) return null;

  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (serviceKey && auth === serviceKey) return null;

  return { error: "chamada interna não autorizada", status: 401 };
}

/** Aceita chamada interna OU usuário autenticado do painel. */
export async function requireInternalOrAppIdentity(
  req: Request,
): Promise<XJIdentity | { internal: true } | XJGuardFailure> {
  if (!requireInternalSecret(req)) return { internal: true };
  return await requireAppIdentity(req);
}
