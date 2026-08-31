/** extend/chat — provider e componentes do chat principal. */
export {
  WhatsAppDataProvider,
  useWhatsAppData,
  type SelectedQueue,
} from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
export type { ChatContact, ChatMessage } from '@/types/chat';
export type { ChatConversation } from '@/types/conversation';
