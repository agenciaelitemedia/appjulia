/**
 * extend/chat — reexporta, sem editar, os componentes e o provider do chat
 * principal usados pelo JulIA Chat para abrir a conversa real.
 */
export {
  WhatsAppDataProvider,
  useWhatsAppData,
  type SelectedQueue,
} from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
export { ChatHeader } from '@/modules/julia-chat/chat/components/ChatHeader';
export { ChatMessages } from '@/modules/julia-chat/chat/components/ChatMessages';
export { ChatInput } from '@/modules/julia-chat/chat/components/ChatInput';
export { ChatRightBar } from '@/modules/julia-chat/chat/components/ChatRightBar';
export { ErrorBoundary } from '@/components/ErrorBoundary';
export { useUserQueueAccess } from '@/hooks/useUserQueueAccess';
export type { ChatMessage, ChatContact } from '@/types/chat';
export type { ChatConversation } from '@/types/conversation';
export { NewConversationDialog } from '@/modules/julia-chat/chat/components/NewConversationDialog';
