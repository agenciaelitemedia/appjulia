// ============================================
// X-Julia — envio de mensagens e persistência no chat
// Usa as credenciais da fila (uazapi/waba) via messaging-factory.
// ============================================
import { createMessagingAdapter } from "../messaging-factory.ts";
import type { XJQueueCreds, XJSession } from "./types.ts";

export interface XJSendOptions {
  type?: "text" | "image" | "video" | "audio" | "document";
  mediaUrl?: string | null;
  caption?: string | null;
  senderName?: string;
}

// deno-lint-ignore no-explicit-any
export async function xjSend(
  supabase: any,
  queue: XJQueueCreds | null,
  session: XJSession,
  text: string,
  options: XJSendOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!queue) return { ok: false, error: "conversa sem fila para envio" };
  if (!session.phone) return { ok: false, error: "contato sem telefone" };

  const adapter = createMessagingAdapter({
    hub: queue.hub ?? "uazapi",
    evo_url: queue.evo_url,
    evo_apikey: queue.evo_apikey,
    waba_token: queue.waba_token,
    waba_number_id: queue.waba_number_id,
  });

  const type = options.type ?? "text";
  let result;
  if (type === "text" || !options.mediaUrl) {
    result = await adapter.sendText(session.phone, text);
  } else {
    result = await adapter.sendMedia(session.phone, options.mediaUrl, options.caption ?? text, type);
  }
  if (!result?.success) return { ok: false, error: result?.error || "falha no envio" };

  await supabase.from("chat_messages").insert({
    contact_id: session.contact_id,
    conversation_id: session.conversation_id,
    client_id: session.client_id,
    text: type === "text" ? text : (options.caption ?? text ?? ""),
    from_me: true,
    type,
    media_url: options.mediaUrl ?? null,
    status: "sent",
    sender_name: options.senderName ?? "X-Julia",
    channel_type: session.channel ?? "whatsapp_uazapi",
    message_id: (result as any).messageId ?? null,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from("xj_sessions")
    .update({ last_agent_message_at: new Date().toISOString() })
    .eq("id", session.id);

  return { ok: true };
}