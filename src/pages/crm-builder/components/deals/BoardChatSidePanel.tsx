import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X, MessageCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { WhatsAppDataProvider, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { useDealConversation } from '../../hooks/useDealConversation';
import type { CRMDeal } from '../../types';
import type { ChatMessage } from '@/types/chat';

interface BoardChatSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CRMDeal | null;
}

/**
 * Sheet lateral overlay (estilo "Detalhes do contato" do /chat) que renderiza
 * a conversa vinculada ao deal selecionado. Reutiliza o módulo de chat completo
 * (ChatHeader / ChatMessages / ChatInput) por meio do WhatsAppDataProvider.
 */
export function BoardChatSidePanel({ open, onOpenChange, deal }: BoardChatSidePanelProps) {
  const navigate = useNavigate();
  const { data: conv, isLoading } = useDealConversation(deal);
  const onClose = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[560px] md:w-[640px] lg:w-[720px] sm:max-w-[720px] p-0 overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium truncate">Conversa do card</span>
          </div>
          <div className="flex items-center gap-1 mr-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate('/chat')}
              title="Abrir no Chat"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isLoading && !conv && deal && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Conversa não encontrada</p>
            <p className="text-xs mt-1">O vínculo deste card não aponta para uma conversa válida.</p>
          </div>
        )}

        {!isLoading && conv && (
          <div className="flex-1 min-h-0 flex flex-col">
            <WhatsAppDataProvider>
              <ScopedChat contactId={conv.contactId} onClose={onClose} />
            </WhatsAppDataProvider>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Componente interno que vive dentro do WhatsAppDataProvider isolado.
 * Sincroniza o contato alvo e renderiza header + mensagens + input.
 */
function ScopedChat({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const { selectedContact, selectContact, selectedContactId } = useWhatsAppData();
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (selectedContactId !== contactId) {
      selectContact(contactId);
    }
  }, [contactId, selectedContactId, selectContact]);

  if (!selectedContact || selectedContactId !== contactId) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ChatHeader
        contact={selectedContact}
        onClose={onClose}
        onShowDetails={() => {}}
      />
      <ChatMessages contactId={contactId} onReply={setReplyToMessage} />
      <ChatInput
        contactId={contactId}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
      />
    </div>
  );
}