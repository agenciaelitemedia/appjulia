/**
 * Módulo JulIA Chat — protótipo isolado da lista de conversas em /julia-chat.
 * Não altera nenhum arquivo do chat atual: consome apenas a edge function
 * `julia-chat-list-feed` (1 request por página).
 */
export const JULIA_CHAT_MODULE = {
  code: 'mvp_chat',
  name: 'JulIA Chat (protótipo)',
  route: '/julia-chat',
  icon: 'MessageSquare',
} as const;
