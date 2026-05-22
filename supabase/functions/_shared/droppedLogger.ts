// ============================================
// Logger de mensagens descartadas pelo webhook de chat.
// Insere em public.chat_dropped_messages para auditoria de mensagens que
// NÃO entraram no chat (no_phone / group_blocked / no_id / group_no_id / no_agent),
// tipicamente propaganda/broadcast/newsletter/@lid.
// Fire-and-forget: falhas no log nunca quebram o webhook.
// ============================================

export interface DroppedMessageRow {
  client_id?: string | null;
  queue_id?: string | null;
  queue_name?: string | null;
  source?: string; // uazapi | waba | instagram
  reason: string;  // no_phone | group_blocked | no_id | group_no_id | no_agent
  event?: string | null;
  chat_id?: string | null;
  from_me?: boolean;
  // deno-lint-ignore no-explicit-any
  msg?: any;
}

function extractPreview(msg: any): string | null {
  if (!msg) return null;
  const raw =
    msg.text
    ?? msg.caption
    ?? msg.message?.conversation
    ?? msg.message?.extendedTextMessage?.text
    ?? msg.message?.imageMessage?.caption
    ?? msg.message?.videoMessage?.caption
    ?? null;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s.slice(0, 200) : null;
}

// deno-lint-ignore no-explicit-any
export async function logDroppedMessage(supabase: any, row: DroppedMessageRow): Promise<void> {
  try {
    await supabase.from("chat_dropped_messages").insert({
      client_id: row.client_id ?? null,
      queue_id: row.queue_id ?? null,
      queue_name: row.queue_name ?? null,
      source: row.source ?? "uazapi",
      reason: row.reason,
      event: row.event ?? null,
      chat_id: row.chat_id ?? null,
      from_me: row.from_me ?? false,
      preview: extractPreview(row.msg),
      raw_payload: row.msg ?? null,
    });
  } catch (e) {
    console.warn(`[droppedLogger] insert failed (${row.reason}):`, e);
  }
}
