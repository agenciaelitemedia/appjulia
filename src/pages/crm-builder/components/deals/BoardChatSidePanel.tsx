import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, ExternalLink, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { WhatsAppDataProvider, useWhatsAppData, type SelectedQueue } from '@/contexts/WhatsAppDataContext';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { useDealConversation } from '../../hooks/useDealConversation';
import { useUserQueueAccess } from '@/hooks/useUserQueueAccess';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
  const { data: queueAccess } = useUserQueueAccess();
  const onClose = () => onOpenChange(false);

  const queueId = conv?.queueId ?? null;
  const hasQueueAccess =
    !queueId
      ? true
      : queueAccess?.queue_access === 'all' || (queueAccess?.queue_ids ?? []).includes(queueId);

  // Fetch full queue row so we can hydrate SelectedQueue properly inside the
  // isolated WhatsAppDataProvider (mirrors how /chat selects a queue).
  const { data: queueRow } = useQuery({
    queryKey: ['side-panel-queue', queueId],
    enabled: !!queueId && hasQueueAccess,
    staleTime: 60_000,
    queryFn: async (): Promise<SelectedQueue | null> => {
      if (!queueId) return null;
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, channel_type, hub, evo_url, evo_apikey, evo_instance')
        .eq('id', queueId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        name: data.name ?? '',
        channel_type: (data.channel_type as string) ?? '',
        hub: (data.hub as string | null) ?? null,
        evo_url: (data.evo_url as string | null) ?? null,
        evo_apikey: (data.evo_apikey as string | null) ?? null,
        evo_instance: (data.evo_instance as string | null) ?? null,
      };
    },
  });

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

        {!isLoading && conv && !hasQueueAccess && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <Lock className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Acesso restrito</p>
            <p className="text-xs mt-1 max-w-xs">
              Você não tem acesso à fila desta conversa. Solicite ao administrador para visualizar.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/chat')}>
              Abrir no Chat
            </Button>
          </div>
        )}

        {!isLoading && conv && hasQueueAccess && (
          <div className="flex-1 min-h-0 flex flex-col">
            <WhatsAppDataProvider>
              <ScopedChat contactId={conv.contactId} queue={queueRow ?? null} onClose={onClose} />
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
function ScopedChat({
  contactId,
  queue,
  onClose,
}: {
  contactId: string;
  queue: SelectedQueue | null;
  onClose: () => void;
}) {
  const {
    selectedContact,
    selectContact,
    selectedContactId,
    selectedQueue,
    setSelectedQueue,
    selectedConversation,
  } = useWhatsAppData();
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  // Hidrata a fila do deal no provider isolado para que loadConversations
  // carregue a chat_conversations correta e o ChatInput respeite os mesmos
  // estados de claim / status do /chat.
  useEffect(() => {
    if (queue && selectedQueue?.id !== queue.id) {
      setSelectedQueue(queue);
    }
  }, [queue, selectedQueue?.id, setSelectedQueue]);

  useEffect(() => {
    if (selectedContactId !== contactId) {
      selectContact(contactId);
    }
  }, [contactId, selectedContactId, selectContact]);

  const queueReady = !queue || selectedQueue?.id === queue.id;
  // Não bloqueamos por selectedConversation: se a conversa não estiver na
  // página atual de `conversations` (paginação/filtros), o painel ficaria
  // carregando para sempre. Mensagens carregam por contactId direto.
  if (!selectedContact || selectedContactId !== contactId || !queueReady) {
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