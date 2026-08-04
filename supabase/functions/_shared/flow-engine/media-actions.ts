// ============================================
// Executores dos nós de mídia (imagem, áudio, vídeo, documento, sticker)
// ============================================
import { createMessagingAdapter } from "../messaging-factory.ts";
import { interpolate } from "./context.ts";
import type { FlowRunContext } from "./types.ts";

const TYPE_LABELS: Record<string, string> = {
  image: "imagem",
  audio: "áudio",
  video: "vídeo",
  document: "documento",
  sticker: "sticker",
};

export async function actionSendMedia(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const mediaType = String(config.media_type ?? "image");
  const label = TYPE_LABELS[mediaType] ?? "mídia";
  const url = interpolate(String(config.url ?? ""), ctx).trim();
  const caption = interpolate(String(config.caption ?? ""), ctx).trim();
  if (!url) throw new Error(`URL do ${label} não informada`);

  if (ctx.simulate) {
    return `Enviaria ${label}: ${url.slice(0, 70)}${caption ? ` (legenda: "${caption.slice(0, 40)}")` : ""}`;
  }
  if (!ctx.contact?.phone) throw new Error("contato sem telefone");

  const queue = ctx.queue;
  if (!queue) throw new Error("conversa sem fila para envio");

  const delay = Number(config.delay_seconds ?? 0);
  if (delay > 0) await new Promise((r) => setTimeout(r, Math.min(delay, 30) * 1000));

  const adapter = createMessagingAdapter({
    hub: queue.hub ?? "uazapi",
    evo_url: queue.evo_url,
    evo_apikey: queue.evo_apikey,
    waba_token: queue.waba_token,
    waba_number_id: queue.waba_number_id,
  });

  // 'sticker' é aceito pelos dois provedores no mesmo formato de mídia.
  const result = await adapter.sendMedia(
    String(ctx.contact.phone),
    url,
    mediaType === "audio" || mediaType === "sticker" ? undefined : caption,
    mediaType as "image" | "video" | "audio" | "document",
  );
  if (!result?.success) throw new Error(result?.error || `falha no envio do ${label}`);

  await supabase.from("chat_messages").insert({
    contact_id: ctx.contact.id,
    conversation_id: ctx.conversation?.id ?? null,
    client_id: ctx.clientId,
    text: caption || null,
    from_me: true,
    type: mediaType,
    media_url: url,
    file_name: String(config.file_name ?? "").trim() || null,
    status: "sent",
    sender_name: "Automação",
    channel_type: ctx.conversation?.channel ?? "whatsapp_uazapi",
    message_id: (result as any).messageId ?? null,
    timestamp: new Date().toISOString(),
  });

  return `${label.charAt(0).toUpperCase()}${label.slice(1)} enviado(a)`;
}
