import { ChatSidePanel } from '@/components/chat/ChatSidePanel';
import { useDealConversation } from '../../hooks/useDealConversation';
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
    />
  );
}