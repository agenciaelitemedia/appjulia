// ============================================
// Chat module configuration
// ============================================

/**
 * Eventos padrão do webhook UaZapi (nomes canônicos da doc oficial:
 * https://docs.uazapi.com/endpoint/post/webhook)
 */
export const UAZAPI_DEFAULT_WEBHOOK_EVENTS = [
  'connection',
  'messages',
  'messages_update',
  'history',
  'chats',
  'contacts',
  'groups',
  'presence',
  'call',
] as const;
