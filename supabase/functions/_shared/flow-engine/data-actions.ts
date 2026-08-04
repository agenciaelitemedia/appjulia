// ============================================
// Ações de dados e integrações (Fase 5)
// Webhook, requisição HTTP, variáveis do fluxo e notificação interna.
// Em modo simulação nada é enviado nem gravado.
// ============================================
import { interpolate } from "./context.ts";
import type { FlowRunContext } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;

function eventPayload(ctx: FlowRunContext, extra: Record<string, unknown> = {}) {
  return {
    event: ctx.event,
    client_id: ctx.clientId,
    conversation: ctx.conversation
      ? {
          id: ctx.conversation.id,
          status: ctx.conversation.status,
          channel: ctx.conversation.channel,
          priority: ctx.conversation.priority,
          protocol: ctx.conversation.protocol,
          queue_id: ctx.conversation.queue_id,
          assigned_to: ctx.conversation.assigned_to,
        }
      : null,
    contact: ctx.contact
      ? { id: ctx.contact.id, name: ctx.contact.name ?? ctx.contact.push_name, phone: ctx.contact.phone }
      : null,
    queue: ctx.queue ? { id: ctx.queue.id, name: ctx.queue.name, hub: ctx.queue.hub } : null,
    message: { text: ctx.messageText, type: ctx.messageType },
    variables: ctx.variables ?? {},
    ...extra,
  };
}

function parseHeaders(raw: unknown, ctx: FlowRunContext): Record<string, string> {
  const headers: Record<string, string> = {};
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    const key = String((item as any)?.key ?? "").trim();
    if (!key) continue;
    headers[key] = interpolate(String((item as any)?.value ?? ""), ctx);
  }
  return headers;
}

function clampTimeout(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(n * 1000, MAX_TIMEOUT_MS);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Enviar para webhook cadastrado (chat_webhooks) ou URL avulsa. */
export async function actionWebhook(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const webhookId = String(config.webhook_id ?? "").trim();
  let url = interpolate(String(config.url ?? "").trim(), ctx);
  let secret: string | null = null;
  let name = "URL avulsa";

  if (webhookId) {
    const { data } = await supabase
      .from("chat_webhooks")
      .select("id, name, url, secret, is_active")
      .eq("id", webhookId)
      .maybeSingle();
    if (!data) throw new Error("webhook cadastrado não encontrado");
    if (data.is_active === false) throw new Error(`webhook "${data.name}" está desativado`);
    url = data.url;
    secret = data.secret ?? null;
    name = data.name;
  }

  if (!url) throw new Error("informe o webhook ou a URL de destino");

  const note = interpolate(String(config.note ?? ""), ctx);
  const payload = eventPayload(ctx, { source: "flow_builder", note: note || undefined });

  if (ctx.simulate) return `Enviaria dados para ${name}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Webhook-Secret"] = secret;

  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: "POST", headers, body: JSON.stringify(payload) },
      clampTimeout(config.timeout_seconds),
    );
    statusCode = res.status;
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (webhookId) {
    await supabase.from("chat_webhook_deliveries").insert({
      webhook_id: webhookId,
      event: `flow.${ctx.event}`,
      payload,
      status_code: statusCode,
      success: !errorMessage,
      error_message: errorMessage,
    });
  }

  if (errorMessage) throw new Error(`falha no webhook ${name}: ${errorMessage}`);
  return `Dados enviados para ${name} (HTTP ${statusCode})`;
}

/** Requisição HTTP livre. Saídas: sucesso / erro. */
export async function actionHttpRequest(
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<{ detail: string; handle: string }> {
  const url = interpolate(String(config.url ?? "").trim(), ctx);
  if (!url) throw new Error("informe a URL da requisição");
  const method = String(config.method ?? "GET").toUpperCase();
  const saveAs = String(config.save_as ?? "resp").trim() || "resp";

  if (ctx.simulate) {
    return { detail: `Chamaria ${method} ${url}`, handle: "success" };
  }

  const headers = parseHeaders(config.headers, ctx);
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const raw = interpolate(String(config.body ?? ""), ctx).trim();
    if (raw) {
      body = raw;
      if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  try {
    const res = await fetchWithTimeout(url, { method, headers, body }, clampTimeout(config.timeout_seconds));
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* resposta não-JSON fica como texto */
    }
    ctx.variables[saveAs] = { status: res.status, ok: res.ok, data: parsed };

    if (!res.ok) {
      return { detail: `${method} ${url} respondeu HTTP ${res.status}`, handle: "error" };
    }
    return { detail: `${method} ${url} — HTTP ${res.status}, salvo em {{${saveAs}}}`, handle: "success" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.variables[saveAs] = { status: 0, ok: false, error: message };
    return { detail: `Falha na requisição: ${message}`, handle: "error" };
  }
}

/** Lê `a.b.0.c` dentro de um objeto/array. */
function readPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) {
      const idx = Number(part);
      return Number.isInteger(idx) ? acc[idx] : undefined;
    }
    if (typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

/** Guardar dados: define variáveis do fluxo por texto com variáveis ou por caminho. */
export async function actionSetVariables(
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const list = Array.isArray(config.items) ? config.items : [];
  const applied: string[] = [];

  for (const item of list) {
    const name = String((item as any)?.name ?? "").trim();
    if (!name) continue;
    const mode = String((item as any)?.mode ?? "text");
    if (mode === "path") {
      const path = String((item as any)?.path ?? "").trim();
      const value = readPath(ctx.variables, path);
      ctx.variables[name] = value ?? "";
    } else {
      ctx.variables[name] = interpolate(String((item as any)?.value ?? ""), ctx);
    }
    applied.push(name);
  }

  if (applied.length === 0) throw new Error("nenhuma variável configurada");
  const prefix = ctx.simulate ? "Guardaria" : "Guardou";
  return `${prefix} ${applied.length === 1 ? "a variável" : "as variáveis"} ${applied.join(", ")}`;
}

/** Notificação interna (e push, via dispatcher existente). */
export async function actionNotify(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const title = interpolate(String(config.title ?? ""), ctx).trim();
  if (!title) throw new Error("informe o título da notificação");
  const body = interpolate(String(config.body ?? ""), ctx).trim() || null;
  const audience = String(config.audience ?? "my_team");
  const alertLevel = String(config.alert_level ?? "info");

  if (ctx.simulate) return `Notificaria a equipe: "${title}"`;

  const { data, error } = await supabase
    .from("internal_notifications")
    .insert({
      title,
      body,
      type: "message",
      poll_options: null,
      audience,
      scope: "office",
      created_by: "flow_builder",
      created_by_name: "Automação",
      created_by_client_id: ctx.clientId,
      status: "draft",
      scheduled_for: null,
      alert_level: alertLevel,
    })
    .select("id")
    .single();

  if (error) throw new Error(`falha ao criar notificação: ${error.message}`);

  const { error: dispatchError } = await supabase.functions.invoke("internal-notification-dispatch", {
    body: { notification_id: data.id },
  });
  if (dispatchError) throw new Error(`falha ao enviar notificação: ${dispatchError.message}`);

  return `Notificação enviada: "${title}"`;
}
