// ============================================
// Chat module configuration
// ============================================

/** Eventos padrão do webhook UaZapi (chat moderno completo) */
export const UAZAPI_DEFAULT_WEBHOOK_EVENTS = [
  'messages',
  'messages.update',
  'messages_update',
  'messages.delete',
  'chats.update',
  'chats.upsert',
  'contacts.update',
  'contacts.upsert',
  'groups.update',
  'connection.update',
  'presence.update',
] as const;
