/**
 * Endereços e chamadas do conector Copiloto (MCP + OAuth próprio da Julia).
 * Nenhum segredo aqui: só a URL pública das edge functions.
 */
const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const OAUTH_BASE = `${FUNCTIONS_BASE}/copiloto-oauth`;
export const MCP_URL = `${FUNCTIONS_BASE}/copiloto-mcp`;

export interface ConsentRequestInfo {
  request_id: string;
  client_name: string;
  scope: string;
  expired: boolean;
  already_used: boolean;
}

export async function fetchConsentRequest(requestId: string): Promise<ConsentRequestInfo> {
  const res = await fetch(`${OAUTH_BASE}/request?request_id=${encodeURIComponent(requestId)}`);
  if (!res.ok) throw new Error('Pedido de autorização não encontrado ou expirado.');
  return res.json();
}

export async function approveConsent(requestId: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error === 'invalid_credentials' ? 'E-mail ou senha inválidos.' : 'Não foi possível autorizar.');
  return data.redirect_url as string;
}

export async function denyConsent(requestId: string): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/deny`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Não foi possível recusar o pedido.');
  return data.redirect_url as string;
}

/** Token curto (15 min) usado apenas para testar as ferramentas dentro da Julia. */
export async function requestTestToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/test-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error === 'invalid_credentials' ? 'Senha inválida.' : 'Falha ao gerar token de teste.');
  return data.access_token as string;
}

/** Chave de acesso de longa duração (Bearer estático) para clientes MCP. */
export async function createAccessKey(
  email: string,
  password: string,
  label: string,
  days: number,
): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/access-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, label, days }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error === 'invalid_credentials' ? 'E-mail ou senha inválidos.' : 'Falha ao gerar a chave.');
  }
  return data.access_token as string;
}

/** Chamada JSON-RPC direta ao MCP, para o testador de ferramentas. */
export async function mcpCall(token: string, method: string, params?: unknown) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `MCP respondeu ${res.status}`);
  if (data?.error) throw new Error(data.error.message || 'Erro no MCP.');
  return data?.result;
}
