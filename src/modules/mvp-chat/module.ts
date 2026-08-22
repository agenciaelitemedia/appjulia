/**
 * Módulo MVP Chat — protótipo isolado da lista de conversas em /mvp-chat.
 * Não altera nenhum arquivo do chat atual: consome apenas a edge function
 * `mvp-chat-list-feed` (1 request por página).
 */
export const MVP_CHAT_MODULE = {
  code: 'mvp_chat',
  name: 'MVP Chat (protótipo)',
  route: '/mvp-chat',
  icon: 'MessageSquare',
} as const;
