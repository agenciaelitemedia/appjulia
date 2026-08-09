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
  /** Tipo gravado em chat_messages (ex.: "ptt" para nota de voz). */
  persistAs?: string;
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
    type: options.persistAs ?? type,
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

// ============================================
// Composição: quebra por \n\n + detecção de mídia por URL
// ============================================

export type XJMediaType = "image" | "video" | "audio" | "document";

const EXT_MAP: Record<string, XJMediaType> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image", bmp: "image",
  mp4: "video", mov: "video", webm: "video", "3gp": "video", mkv: "video",
  mp3: "audio", ogg: "audio", opus: "audio", m4a: "audio", wav: "audio", aac: "audio",
  pdf: "document", doc: "document", docx: "document", xls: "document", xlsx: "document",
  ppt: "document", pptx: "document", csv: "document", txt: "document", zip: "document",
};

const URL_RE = /https?:\/\/[^\s<>"')]+/i;
const URL_RE_ALL = /https?:\/\/[^\s<>"')]+/gi;

/** Divide o texto em blocos separados por dupla quebra de linha. */
export function splitMessageBlocks(text: string): string[] {
  return String(text ?? "")
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/**
 * Separa links do texto que vai ser narrado em áudio.
 * Devolve o texto sem os links (`spoken`) e uma mensagem de texto por link,
 * mantendo a ordem de aparição. URLs nunca devem ser lidas em voz alta.
 */
export function extractLinks(text: string): { spoken: string; linkMessages: string[] } {
  const raw = String(text ?? "");
  const found = raw.match(URL_RE_ALL) ?? [];
  if (found.length === 0) return { spoken: raw.trim(), linkMessages: [] };

  let spoken = raw;
  const linkMessages: string[] = [];
  for (const hit of found) {
    const url = hit.replace(/[.,;:!?)]+$/, "");
    linkMessages.push(url);
    spoken = spoken.replace(hit, " ");
  }

  spoken = spoken
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { spoken, linkMessages };
}

/** Detecta uma URL de mídia dentro do bloco e devolve tipo + legenda restante. */
export function detectMediaInBlock(
  block: string,
): { url: string; type: XJMediaType; caption: string } | null {
  const match = block.match(URL_RE);
  if (!match) return null;
  const url = match[0].replace(/[.,;:!?)]+$/, "");
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch { /* usa a url crua */ }
  const ext = (pathname.split(".").pop() ?? "").toLowerCase();
  const type = EXT_MAP[ext];
  if (!type) return null;
  const caption = block.replace(match[0], "").replace(/\s+/g, " ").trim();
  return { url, type, caption };
}

/**
 * Envia uma resposta possivelmente multi-bloco:
 * - `\n\n` gera mensagens separadas, em ordem;
 * - blocos com link de mídia (.mp4, .jpg, .mp3, .pdf, ...) são enviados como mídia;
 * - falha de mídia faz fallback para texto.
 */
// deno-lint-ignore no-explicit-any
export async function xjSendComposed(
  supabase: any,
  queue: XJQueueCreds | null,
  session: XJSession,
  text: string,
  options: XJSendOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  const blocks = splitMessageBlocks(text);
  if (blocks.length === 0) return { ok: true };

  let anyOk = false;
  let lastError: string | undefined;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 700));

    const media = detectMediaInBlock(block);
    if (!media) {
      const sent = await xjSend(supabase, queue, session, block, { senderName: options.senderName });
      if (sent.ok) anyOk = true; else lastError = sent.error;
      continue;
    }

    // Áudio não aceita legenda: envia o texto antes, separado.
    if (media.type === "audio" && media.caption) {
      const pre = await xjSend(supabase, queue, session, media.caption, { senderName: options.senderName });
      if (pre.ok) anyOk = true; else lastError = pre.error;
      await new Promise((r) => setTimeout(r, 500));
    }

    const sentMedia = await xjSend(supabase, queue, session, media.caption, {
      type: media.type,
      mediaUrl: media.url,
      caption: media.type === "audio" ? "" : media.caption,
      senderName: options.senderName,
    });

    if (sentMedia.ok) {
      anyOk = true;
      continue;
    }

    lastError = sentMedia.error;
    const fallback = await xjSend(supabase, queue, session, block, { senderName: options.senderName });
    if (fallback.ok) anyOk = true; else lastError = fallback.error;
  }

  return anyOk ? { ok: true } : { ok: false, error: lastError ?? "falha no envio" };
}