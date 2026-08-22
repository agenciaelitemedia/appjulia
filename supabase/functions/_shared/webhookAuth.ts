// ============================================
// Autenticação dos webhooks de provedor (F4 etapas 4-5)
//
// Duas verificações independentes:
//   1. token por fila (UaZapi/Evolution não assinam o corpo) — o token fica em
//      queues.webhook_token e vem na URL (?t=) ou no header x-webhook-token.
//      Fila SEM token configurado continua aceitando (compatibilidade): o
//      provedor já está apontado para a URL antiga.
//   2. assinatura HMAC-SHA256 da Meta (x-hub-signature-256) usando
//      META_APP_SECRET. Sem o segredo configurado, apenas registra.
//
// Toda recusa é registrada em public.webhook_rejections.
// ============================================

export interface WebhookCheck {
  ok: boolean;
  reason?: string;
  /** true quando a verificação foi apenas informativa (sem segredo/token configurado) */
  advisory?: boolean;
}

export async function logWebhookRejection(
  supabase: any,
  entry: {
    source: string;
    reason: string;
    queue_id?: string | null;
    client_id?: string | null;
    ip?: string | null;
    path?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("webhook_rejections").insert({
      source: entry.source,
      reason: entry.reason,
      queue_id: entry.queue_id ?? null,
      client_id: entry.client_id ? String(entry.client_id) : null,
      ip: entry.ip ?? null,
      path: entry.path ?? null,
      detail: entry.detail ? String(entry.detail).slice(0, 1000) : null,
    });
  } catch (err) {
    console.warn("[webhookAuth] falha ao registrar recusa:", String(err));
  }
}

export function clientIpOf(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

/** Comparação em tempo constante (evita oráculo por tempo). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica o token compartilhado da fila. */
export function verifyQueueToken(req: Request, url: URL, queueToken: unknown): WebhookCheck {
  const expected = String(queueToken ?? "").trim();
  if (!expected) return { ok: true, advisory: true };

  const provided =
    (url.searchParams.get("t") ?? url.searchParams.get("token") ?? "").trim() ||
    (req.headers.get("x-webhook-token") ?? "").trim();

  if (!provided) return { ok: false, reason: "token_ausente" };
  if (!safeEqual(provided, expected)) return { ok: false, reason: "token_invalido" };
  return { ok: true };
}

/** Verifica a assinatura x-hub-signature-256 da Meta sobre o corpo cru. */
export async function verifyMetaSignature(req: Request, rawBody: string): Promise<WebhookCheck> {
  const secret = (Deno.env.get("META_APP_SECRET") ?? "").trim();
  const header = (req.headers.get("x-hub-signature-256") ?? "").trim();

  if (!secret) return { ok: true, advisory: true };
  if (!header) return { ok: false, reason: "assinatura_ausente" };

  const received = header.replace(/^sha256=/i, "").toLowerCase();
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (!safeEqual(received, expected)) return { ok: false, reason: "assinatura_invalida" };
    return { ok: true };
  } catch (err) {
    console.warn("[webhookAuth] falha ao calcular HMAC:", String(err));
    return { ok: true, advisory: true };
  }
}
