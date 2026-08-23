/**
 * Módulo JulIA Chat — chat oficial do sistema, servido em /chat.
 * Lista de conversas em 1 request (edge function `julia-chat-list-feed`)
 * e árvore de componentes de conversa isolada em `./chat`.
 * O chat antigo permanece apenas em /chat-old (backup temporário).
 */
export const JULIA_CHAT_MODULE = {
  code: 'chat',
  name: 'JulIA Chat',
  route: '/chat',
  icon: 'MessageSquare',
} as const;
