import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Lock, MessageSquare } from 'lucide-react';
import { supabase } from '../extend/db';
import { Button, Skeleton } from '../extend/ui';
import {
  ChatHeader,
  ChatInput,
  ChatMessages,
  useUserQueueAccess,
  useWhatsAppData,
  type ChatContact,
  type ChatConversation,
  type ChatMessage,
  type SelectedQueue,
} from '../extend/chat';

export interface JuliaChatTarget {
  contactId: string;
  queueId: string | null;
  conversationId: string | null;
}

interface Props {
  target: JuliaChatTarget | null;
  onClose: () => void;
}

/**
 * Coluna central do MVP: carrega a conversa real com os mesmos componentes do
 * chat principal (header + timeline + input). Segue o padrão já validado em
 * `ChatSidePanel` → `ScopedChat`: hidrata fila, contato e conversa e sincroniza
 * o `WhatsAppDataProvider` isolado do módulo.
 */
export function JuliaChatConversation({ target, onClose }: Props) {
  const { data: queueAccess } = useUserQueueAccess();
  const queueId = target?.queueId ?? null;
  const hasQueueAccess = !queueId
    ? true
    : queueAccess?.queue_access === 'all' || (queueAccess?.queue_ids ?? []).includes(queueId);

  if (!target) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <MessageSquare className="h-10 w-10 opacity-40" aria-hidden />
        <p className="text-sm">Selecione uma conversa na lista para abrir o atendimento.</p>
      </div>
    );
  }

  if (!hasQueueAccess) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Lock className="h-10 w-10 opacity-40" aria-hidden />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="max-w-xs text-xs">
          Você não tem acesso à fila desta conversa. Solicite ao administrador para visualizar.
        </p>
      </div>
    );
  }

  return <ScopedConversation key={target.contactId} target={target} onClose={onClose} />;
}

function ScopedConversation({ target, onClose }: { target: JuliaChatTarget; onClose: () => void }) {
  const { contactId, queueId, conversationId } = target;
  const {
    selectedContact,
    selectContact,
    selectedContactId,
    selectedQueue,
    setSelectedQueue,
    upsertConversation,
    contactHydrationError,
    retryHydrateSelectedContact,
    showDetailPanel,
    setShowDetailPanel,
    rightBarTab,
    setRightBarTab,
  } = useWhatsAppData();

  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showTimeoutFallback, setShowTimeoutFallback] = useState(false);

  const { data: queueRow } = useQuery({
    queryKey: ['julia-chat-queue', queueId],
    enabled: !!queueId,
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
        name: (data as any).name ?? '',
        channel_type: ((data as any).channel_type as string) ?? '',
        hub: ((data as any).hub as string | null) ?? null,
        evo_url: ((data as any).evo_url as string | null) ?? null,
        evo_apikey: ((data as any).evo_apikey as string | null) ?? null,
        evo_instance: ((data as any).evo_instance as string | null) ?? null,
      };
    },
  });

  const {
    data: rowContact,
    isLoading: isLoadingContact,
    error: contactError,
    refetch: refetchContact,
  } = useQuery({
    queryKey: ['julia-chat-contact', contactId],
    enabled: !!contactId,
    staleTime: 60_000,
    queryFn: async (): Promise<ChatContact | null> => {
      const { data, error } = await supabase
        .from('chat_contacts')
        .select(
          'id,client_id,cod_agent,channel_source,channel_type,remote_jid,phone,name,avatar,is_group,is_archived,is_muted,unread_count,last_message_at,last_message_text,created_at,updated_at',
        )
        .eq('id', contactId)
        .maybeSingle();
      if (error) throw error;
      return (data as ChatContact | null) ?? null;
    },
  });

  const { data: rowConversation } = useQuery({
    queryKey: ['julia-chat-conversation', conversationId],
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
    if (rowConversation) upsertConversation(rowConversation);
  }, [rowConversation, upsertConversation]);

  useEffect(() => {
    if (queueRow && selectedQueue?.id !== queueRow.id) setSelectedQueue(queueRow);
  }, [queueRow, selectedQueue?.id, setSelectedQueue]);

  useEffect(() => {
    if (selectedContactId !== contactId) selectContact(contactId);
  }, [contactId, selectedContactId, selectContact]);

  useEffect(() => {
    setShowTimeoutFallback(false);
    const t = setTimeout(() => setShowTimeoutFallback(true), 4000);
    return () => clearTimeout(t);
  }, [contactId]);

  const queueReady = !queueId || selectedQueue?.id === queueId;
  const effectiveContact = rowContact ?? selectedContact;

  const errorMessage =
    (contactError instanceof Error ? contactError.message : null) ||
    (rowContact === null && !isLoadingContact ? 'Contato não encontrado.' : null) ||
    contactHydrationError;

  if (errorMessage && !effectiveContact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <AlertTriangle className="h-10 w-10 opacity-40" aria-hidden />
        <p className="text-sm font-medium">Não foi possível abrir a conversa</p>
        <p className="max-w-xs text-xs">{errorMessage}</p>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            refetchContact();
            retryHydrateSelectedContact();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!effectiveContact || selectedContactId !== contactId || !queueReady) {
    if (showTimeoutFallback) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 opacity-40" aria-hidden />
          <p className="text-sm font-medium">A conversa demorou para carregar</p>
          <p className="max-w-xs text-xs">
            {!queueReady ? 'Aguardando hidratação da fila…' : 'Aguardando dados do contato…'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              refetchContact();
              retryHydrateSelectedContact();
              setShowTimeoutFallback(false);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        contact={effectiveContact}
        onClose={onClose}
        onShowDetails={() => {
          if (showDetailPanel && rightBarTab === 'contact') {
            setShowDetailPanel(false);
          } else {
            setRightBarTab('contact');
            setShowDetailPanel(true);
          }
        }}
        onShowCrm={() => {
          setRightBarTab('crm');
          setShowDetailPanel(true);
        }}
      />
      <ChatMessages
        contactId={contactId}
        onReply={setReplyToMessage}
        onEdit={(m) => {
          setReplyToMessage(null);
          setEditingMessage(m);
        }}
      />
      <ChatInput
        contactId={contactId}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
      />
    </div>
  );
}
