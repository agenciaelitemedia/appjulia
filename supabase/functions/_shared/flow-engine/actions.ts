// ============================================
// Executores de ação dos nós de fluxo (Chat)
// Em modo simulação nada é gravado nem enviado.
// ============================================
import { createMessagingAdapter } from "../messaging-factory.ts";
import { interpolate } from "./context.ts";
import type { FlowRunContext } from "./types.ts";

export async function actionSendText(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const text = interpolate(String(config.text ?? ""), ctx).trim();
  if (!text) throw new Error("mensagem vazia");
  if (!ctx.contact?.phone) throw new Error("contato sem telefone");

  if (ctx.simulate) return `Enviaria: "${text.slice(0, 80)}"`;

  const delay = Number(config.delay_seconds ?? 0);
  if (delay > 0) await new Promise((r) => setTimeout(r, Math.min(delay, 30) * 1000));

  const queue = ctx.queue;
  if (!queue) throw new Error("conversa sem fila para envio");

  const adapter = createMessagingAdapter({
    hub: queue.hub ?? "uazapi",
    evo_url: queue.evo_url,
    evo_apikey: queue.evo_apikey,
    waba_token: queue.waba_token,
    waba_number_id: queue.waba_number_id,
  });

  const result = await adapter.sendText(String(ctx.contact.phone), text);
  if (!result?.success) throw new Error(result?.error || "falha no envio");

  await supabase.from("chat_messages").insert({
    contact_id: ctx.contact.id,
    conversation_id: ctx.conversation?.id ?? null,
    client_id: ctx.clientId,
    text,
    from_me: true,
    type: "text",
    status: "sent",
    sender_name: "Automação",
    channel_type: ctx.conversation?.channel ?? "whatsapp_uazapi",
    message_id: (result as any).messageId ?? null,
    timestamp: new Date().toISOString(),
  });

  return `Mensagem enviada (${text.length} caracteres)`;
}

export async function actionTag(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const tagName = String(config.tag_name ?? "").trim();
  if (!tagName) throw new Error("etiqueta não configurada");
  if (!ctx.conversation?.id) throw new Error("sem conversa para etiquetar");

  const current: string[] = Array.isArray(ctx.conversation.tags) ? [...ctx.conversation.tags] : [];
  const remove = config.action === "remove";
  const next = remove ? current.filter((t) => t !== tagName) : Array.from(new Set([...current, tagName]));

  if (ctx.simulate) return remove ? `Removeria "${tagName}"` : `Adicionaria "${tagName}"`;

  await supabase.from("chat_conversations").update({ tags: next }).eq("id", ctx.conversation.id);
  ctx.conversation.tags = next;
  return remove ? `Etiqueta "${tagName}" removida` : `Etiqueta "${tagName}" aplicada`;
}

export async function actionHandoff(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  if (!ctx.conversation?.id) throw new Error("sem conversa para encaminhar");

  const update: Record<string, unknown> = {
    status: ctx.conversation.status === "resolved" || ctx.conversation.status === "closed"
      ? "pending"
      : ctx.conversation.status,
    priority: config.priority ?? ctx.conversation.priority ?? "normal",
  };
  if (config.queue_id) update.queue_id = config.queue_id;

  if (ctx.simulate) {
    return `Encaminharia para humano${config.queue_id ? " (troca de fila)" : ""}`;
  }

  await supabase.from("chat_conversations").update(update).eq("id", ctx.conversation.id);
  Object.assign(ctx.conversation, update);

  const note = interpolate(String(config.note ?? ""), ctx).trim();
  if (note) {
    await supabase.from("chat_internal_notes" as never).insert({
      conversation_id: ctx.conversation.id,
      client_id: ctx.clientId,
      author_name: "Automação",
      note,
    }).then(
      () => undefined,
      (e: unknown) => console.warn("[flow] nota interna ignorada:", (e as Error)?.message),
    );
  }

  return "Encaminhado para atendimento humano";
}

export async function actionEnd(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const reason = interpolate(String(config.reason ?? ""), ctx).trim();
  if (!config.resolve_conversation || !ctx.conversation?.id) {
    return reason ? `Fluxo encerrado: ${reason}` : "Fluxo encerrado";
  }
  if (ctx.simulate) return "Encerraria e resolveria a conversa";

  await supabase
    .from("chat_conversations")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      close_reason: reason || "Encerrado por automação",
    })
    .eq("id", ctx.conversation.id);

  return "Conversa resolvida pela automação";
}