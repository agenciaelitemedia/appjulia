import { ChatSidePanel } from '@/components/chat/ChatSidePanel';
import { useDealConversation } from '../../hooks/useDealConversation';
import { useAuth } from '@/contexts/AuthContext';
import type { CRMDeal } from '../../types';

interface BoardChatSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CRMDeal | null;
}

/**
 * Wrapper fino que resolve a conversa vinculada ao deal e delega o render
 * para o painel reusável `ChatSidePanel`.
 */
export function BoardChatSidePanel({ open, onOpenChange, deal }: BoardChatSidePanelProps) {
  const { data: conv, isLoading } = useDealConversation(deal);
  const { hasPermission, isAdmin } = useAuth();
  // Só permite escrita no chat (assumir/enviar) se o usuário tiver o módulo
  // `chat_admin`. Sem ele, o painel abre em modo somente-leitura.
  const canWriteChat =
    isAdmin ||
    hasPermission('chat_admin', 'edit') ||
    hasPermission('chat_admin', 'create');

  const target = conv
    ? {
        contactId: conv.contactId,
        queueId: conv.queueId,
        conversationId: conv.conversationId,
      }
    : null;

  return (
    <ChatSidePanel
      open={open}
      onOpenChange={onOpenChange}
      target={target}
      isLoading={isLoading}
      title="Conversa do card"
      emptyDescription="O vínculo deste card não aponta para uma conversa válida."
      readOnly={!canWriteChat}
    />
  );
}