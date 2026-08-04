// ============================================
// Montagem do contexto de execução + interpolação de variáveis
// ============================================
import type { FlowRunContext } from "./types.ts";

export async function buildRunContext(
  supabase: any,
  input: {
    event: string;
    simulate: boolean;
    client_id: string;
    conversation_id?: string | null;
    contact_id?: string | null;
    message_text?: string | null;
    message_type?: string | null;
    tag?: string | null;
    variables?: Record<string, unknown>;
  },
): Promise<FlowRunContext> {
  let conversation: Record<string, any> | null = null;
  let contact: Record<string, any> | null = null;
  let queue: Record<string, any> | null = null;

  if (input.conversation_id) {
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", input.conversation_id)
      .maybeSingle();
    conversation = data ?? null;
  }

  const contactId = input.contact_id ?? conversation?.contact_id ?? null;
  if (contactId) {
    const { data } = await supabase
      .from("chat_contacts")
      .select("*")
      .eq("id", contactId)
      .maybeSingle();
    contact = data ?? null;
  }

  const queueId = conversation?.queue_id ?? null;
  if (queueId) {
    const { data } = await supabase.from("queues").select("*").eq("id", queueId).maybeSingle();
    queue = data ?? null;
  }

  // Última resposta do atendente (mensagem enviada), usada nos nós de tempo/inatividade
  let lastAgentMessageAt: string | null = null;
  if (conversation?.id) {
    const { data } = await supabase
      .from("chat_messages")
      .select("timestamp")
      .eq("conversation_id", conversation.id)
      .eq("from_me", true)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastAgentMessageAt = data?.timestamp ?? null;
  }

  return {
    event: input.event,
    simulate: input.simulate,
    clientId: input.client_id,
    conversation,
    contact,
    queue,
    messageText: input.message_text ?? "",
    messageType: input.message_type ?? "text",
    tag: input.tag ?? null,
    variables: { ...(input.variables ?? {}) },
    lastAgentMessageAt,
  };
}

/** Minutos decorridos desde um instante ISO. `null` quando não há referência. */
export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 60000);
}

/** Substitui `{{chave}}` por valores do contexto. Desconhecidos viram string vazia. */
export function interpolate(template: string, ctx: FlowRunContext): string {
  if (!template) return "";
  const map: Record<string, string> = {
    nome: ctx.contact?.name ?? ctx.contact?.push_name ?? "",
    telefone: ctx.contact?.phone ?? "",
    protocolo: ctx.conversation?.protocol ?? "",
    fila: ctx.queue?.name ?? "",
    atendente: ctx.conversation?.assigned_to ?? "",
    status: ctx.conversation?.status ?? "",
    mensagem: ctx.messageText ?? "",
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_full, key: string) => {
    if (key in map) return map[key];
    const fromVars = ctx.variables?.[key];
    return fromVars === undefined || fromVars === null ? "" : String(fromVars);
  });
}

/** Valor de um campo usado pelos nós de condição. */
export function resolveField(field: string, ctx: FlowRunContext): string {
  switch (field) {
    case "message_text":
      return ctx.messageText ?? "";
    case "conversation_status":
      return ctx.conversation?.status ?? "";
    case "queue_name":
      return ctx.queue?.name ?? "";
    case "assigned_to":
      return ctx.conversation?.assigned_to ?? "";
    case "contact_name":
      return ctx.contact?.name ?? ctx.contact?.push_name ?? "";
    case "contact_phone":
      return ctx.contact?.phone ?? "";
    case "julia_active":
      // Estado real da Julia vive no banco externo (sessões) — Fase 4.
      return String(ctx.variables?.julia_active ?? "");
    case "minutes_since_lead_reply": {
      const v = minutesSince(ctx.conversation?.last_customer_message_at);
      return v === null ? "" : String(v);
    }
    case "minutes_since_agent_reply": {
      const v = minutesSince(ctx.lastAgentMessageAt);
      return v === null ? "" : String(v);
    }
    case "channel":
      return ctx.conversation?.channel ?? "";
    case "priority":
      return ctx.conversation?.priority ?? "";
    default:
      return String(ctx.variables?.[field] ?? "");
  }
}

export function compare(left: string, operator: string, right: string): boolean {
  const a = (left ?? "").toString().trim().toLowerCase();
  const b = (right ?? "").toString().trim().toLowerCase();

  if (operator === "greater_than" || operator === "less_than") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) return false;
    return operator === "greater_than" ? na > nb : na < nb;
  }

  switch (operator) {
    case "contains":
      return a.includes(b);
    case "not_contains":
      return !a.includes(b);
    case "equals":
      return a === b;
    case "not_equals":
      return a !== b;
    case "is_empty":
      return a.length === 0;
    case "is_not_empty":
      return a.length > 0;
    default:
      return false;
  }
}