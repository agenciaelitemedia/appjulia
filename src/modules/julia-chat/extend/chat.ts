/**
 * extend/chat — reexporta, sem editar, os componentes e o provider do chat
 * principal usados pelo JulIA Chat para abrir a conversa real.
 */
export {
  WhatsAppDataProvider,
  useWhatsAppData,
  type SelectedQueue,
} from '@/contexts/WhatsAppDataContext';
export { ChatHeader } from '@/components/chat/ChatHeader';
export { ChatMessages } from '@/components/chat/ChatMessages';
export { ChatInput } from '@/components/chat/ChatInput';
export { ChatRightBar } from '@/components/chat/ChatRightBar';
export { ErrorBoundary } from '@/components/ErrorBoundary';
export { useUserQueueAccess } from '@/hooks/useUserQueueAccess';
export type { ChatMessage, ChatContact } from '@/types/chat';
export type { ChatConversation } from '@/types/conversation';
export { NewConversationDialog } from '@/components/chat/NewConversationDialog';
