// ============================================
// Chat module configuration
// ============================================

/** Janela de histórico exibida e ingerida (dias) */
export const CHAT_HISTORY_WINDOW_DAYS = 3;

/** ISO timestamp do início da janela (calculado em runtime) */
export function getChatHistoryWindowStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - CHAT_HISTORY_WINDOW_DAYS);
  return d.toISOString();
}

/** Eventos padrão do webhook UaZapi (chat moderno completo) */
export const UAZAPI_DEFAULT_WEBHOOK_EVENTS = [
  'messages',
  'messages.update',
  'messages.delete',
  'chats.update',
  'chats.upsert',
  'contacts.update',
  'contacts.upsert',
  'groups.update',
  'connection.update',
  'presence.update',
] as const;
