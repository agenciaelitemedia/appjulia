import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, ExternalLink, Lock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { WhatsAppDataProvider, useWhatsAppData, type SelectedQueue } from '@/contexts/WhatsAppDataContext';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { useUserQueueAccess } from '@/hooks/useUserQueueAccess';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { setPendingSelection } from '@/lib/chat/pendingSelection';
import type { ChatMessage, ChatContact } from '@/types/chat';
import type { ChatConversation } from '@/types/conversation';

/**
 * Alvo de uma conversa de chat já resolvido (contato + fila + conversa
 * opcional). Usado pelos vários domínios (CRM Builder, CRM Júlia, Contratos)
 * para abrir o painel reusável.
 */
export interface ChatSidePanelTarget {
  contactId: string;
  queueId: string | null;
  conversationId: string | null;
}

export interface ChatSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conversa-alvo já resolvida. `null` => mostra "não encontrada". */
  target: ChatSidePanelTarget | null;
  /** Skeleton externo (ex.: enquanto o hook que resolve o target carrega). */
  isLoading?: boolean;
  /** Texto do cabeçalho do Sheet. */
  title?: string;
  /** Texto exibido quando o target é null. */
  emptyDescription?: string;
}

/**
 * Painel lateral de chat reusável. Encapsula:
 *   - Validação de acesso à fila (useUserQueueAccess)
 *   - Hidratação da queue, contato e conversa
 *   - WhatsAppDataProvider isolado + ChatHeader + ChatMessages + ChatInput
 *   - Botão "Abrir no Chat" via setPendingSelection + navigate('/chat')
 *
 * Originalmente extraído de BoardChatSidePanel para uso também no CRM da
 * Jul.IA e em Contratos.
 */
export function ChatSidePanel({
  open,
  onOpenChange,
  target,
  isLoading = false,
  title = 'Conversa',
  emptyDescription = 'O vínculo não aponta para uma conversa válida.',
}: ChatSidePanelProps) {
  const navigate = useNavigate();
  const { data: queueAccess } = useUserQueueAccess();
  const onClose = () => onOpenChange(false);

  const queueId = target?.queueId ?? null;
  const hasQueueAccess =
    !queueId
      ? true
      : queueAccess?.queue_access === 'all' || (queueAccess?.queue_ids ?? []).includes(queueId);

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
        <VisuallyHidden>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Mensagens vinculadas a este registro</SheetDescription>
        </VisuallyHidden>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1 mr-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                if (target?.contactId) {
                  setPendingSelection({
                    contactId: target.contactId,
                    queueId: target.queueId,
                    conversationId: target.conversationId,
                  });
                }
                navigate('/chat');
              }}
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

        {!isLoading && !target && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Conversa não encontrada</p>
            <p className="text-xs mt-1 max-w-xs">{emptyDescription}</p>
          </div>
        )}

        {!isLoading && target && !hasQueueAccess && (
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

        {!isLoading && target && hasQueueAccess && (
          <div className="flex-1 min-h-0 flex flex-col">
            <WhatsAppDataProvider>
              <ScopedChat
                contactId={target.contactId}
                conversationId={target.conversationId}
                queue={queueRow ?? null}
                onClose={onClose}
              />
            </WhatsAppDataProvider>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Componente interno que vive dentro do WhatsAppDataProvider isolado.
 * Sincroniza o contato/queue/conversa alvo e renderiza header + mensagens + input.
 */
function ScopedChat({
  contactId,
  conversationId,
  queue,
  onClose,
}: {
  contactId: string;
  conversationId: string | null;
  queue: SelectedQueue | null;
  onClose: () => void;
}) {
  const {
    selectedContact,
    selectContact,
    selectedContactId,
    selectedQueue,
    setSelectedQueue,
    contactHydrationError,
    retryHydrateSelectedContact,
    upsertConversation,
  } = useWhatsAppData();
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [showTimeoutFallback, setShowTimeoutFallback] = useState(false);

  const { data: dealContact, isLoading: isLoadingContact, error: contactError, refetch: refetchContact } = useQuery({
    queryKey: ['side-panel-contact', contactId],
    enabled: !!contactId,
    staleTime: 60_000,
    queryFn: async (): Promise<ChatContact | null> => {
      const { data, error } = await supabase
        .from('chat_contacts')
        .select('id,client_id,cod_agent,channel_source,channel_type,remote_jid,phone,name,avatar,is_group,is_archived,is_muted,unread_count,last_message_at,last_message_text,created_at,updated_at')
        .eq('id', contactId)
        .maybeSingle();
      if (error) throw error;
      return (data as ChatContact | null) ?? null;
    },
  });

  const { data: dealConversation } = useQuery({
    queryKey: ['side-panel-conversation', conversationId],
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: async (): Promise<ChatConversation | null> => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();
      if (error) throw error;
      return (data as ChatConversation | null) ?? null;
    },
  });

  useEffect(() => {
    if (dealConversation) upsertConversation(dealConversation);
  }, [dealConversation, upsertConversation]);

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
  const effectiveContact = dealContact ?? selectedContact;

  useEffect(() => {
    setShowTimeoutFallback(false);
    const t = setTimeout(() => setShowTimeoutFallback(true), 4000);
    return () => clearTimeout(t);
  }, [contactId]);

  const errorMessage =
    (contactError instanceof Error ? contactError.message : null) ||
    (dealContact === null && !isLoadingContact ? 'Contato não encontrado.' : null) ||
    contactHydrationError;

  if (errorMessage && !effectiveContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-3">
        <AlertTriangle className="h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">Não foi possível abrir a conversa</p>
        <p className="text-xs max-w-xs">{errorMessage}</p>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { refetchContact(); retryHydrateSelectedContact(); }}
            className="rounded-full"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!effectiveContact || selectedContactId !== contactId || !queueReady) {
    if (showTimeoutFallback) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-3">
          <AlertTriangle className="h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">A conversa demorou para carregar</p>
          <p className="text-xs max-w-xs">
            {!queueReady ? 'Aguardando hidratação da fila…' : 'Aguardando dados do contato…'}
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { refetchContact(); retryHydrateSelectedContact(); setShowTimeoutFallback(false); }}
              className="rounded-full"
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }
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
        contact={effectiveContact}
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