import { ChatSidePanel } from '@/components/chat/ChatSidePanel';
import { useDealConversation } from '../../hooks/useDealConversation';
import { useAuth } from '@/contexts/AuthContext';
import { isOwnerUser } from '@/lib/auth/isOwner';
import type { BoardPermissionMode } from '../../types';
import type { CRMDeal } from '../../types';

interface BoardChatSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CRMDeal | null;
  /** Modo de permissão do quadro. 'disabled' libera as ações do chat. */
  permissionMode?: BoardPermissionMode;
}

/**
 * Wrapper fino que resolve a conversa vinculada ao deal e delega o render
 * para o painel reusável `ChatSidePanel`.
 */
export function BoardChatSidePanel({ open, onOpenChange, deal, permissionMode = 'disabled' }: BoardChatSidePanelProps) {
  const { data: conv, isLoading } = useDealConversation(deal);
  const { hasPermission, isAdmin, user } = useAuth();
  // Regras:
  //  1. Admin ou dono do client_id: acesso total sempre.
  //  2. Permissionamento do quadro desativado: acesso total.
  //  3. Permissionamento ativo: precisa do módulo `chat` (inbox, rota /chat).
  const canWriteChat =
    isAdmin ||
    isOwnerUser(user) ||
    permissionMode === 'disabled' ||
    hasPermission('chat', 'view');

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