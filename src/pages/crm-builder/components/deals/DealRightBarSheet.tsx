import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { getBrPhoneVariants } from '@/lib/phoneVariants';
import {
  WhatsAppDataProvider,
  useWhatsAppData,
  type SelectedQueue,
} from '@/modules/julia-chat/chat/contexts/WhatsAppDataContext';
import { ChatRightBar } from '@/modules/julia-chat/chat/components/ChatRightBar';
import { useDealConversation } from '../../hooks/useDealConversation';
import { DealDetailsSheet } from './DealDetailsSheet';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation } from '@/types/conversation';

type DealDetailsProps = React.ComponentProps<typeof DealDetailsSheet>;

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Abre os detalhes do card do CRM Builder usando a mesma right-bar do chat
 * (abas Contato / CRM / Telefonia), com a aba CRM ativa.
 *
 * Sem vínculo de contato/conversa no chat, tenta resolver o contato pelo
 * telefone do card; se não existir, exibe a mesma right-bar com um contato
 * sintético (apenas nome/telefone do card) e estados vazios.
 */
export function DealRightBarSheet(props: DealDetailsProps) {
  const { deal, open, onOpenChange } = props;
  const { data: conv, isLoading } = useDealConversation(deal);
  const linkedContactId = conv?.contactId ?? null;
  const queueId = conv?.queueId ?? null;

  const phoneVariants = useMemo(
    () => getBrPhoneVariants(deal?.contact_phone),
    [deal?.contact_phone],
  );

  // Sem vínculo direto: tenta achar o contato do chat pelo telefone do card.
  const { data: phoneContactId, isLoading: isLoadingPhoneContact } = useQuery({
    queryKey: ['deal-rightbar-contact-by-phone', deal?.client_id, phoneVariants],
    enabled: open && !linkedContactId && !isLoading && phoneVariants.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      let query = supabase.from('chat_contacts').select('id').in('phone', phoneVariants).limit(1);
      if (deal?.client_id) query = query.eq('client_id', String(deal.client_id));
      const { data, error } = await query.maybeSingle();
      if (error) return null;
      return (data?.id as string) ?? null;
    },
  });

  const contactId = linkedContactId ?? phoneContactId ?? null;

  const { data: queueRow } = useQuery({
    queryKey: ['deal-rightbar-queue', queueId],
    enabled: !!queueId && open,
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
        name: (data.name as string) ?? '',
        channel_type: (data.channel_type as string) ?? '',
        hub: (data.hub as string | null) ?? null,
        evo_url: (data.evo_url as string | null) ?? null,
        evo_apikey: (data.evo_apikey as string | null) ?? null,
        evo_instance: (data.evo_instance as string | null) ?? null,
      };
    },
  });

  const syntheticContact: ChatContact = useMemo(
    () => ({
      id: NIL_UUID,
      client_id: deal?.client_id ? String(deal.client_id) : '',
      phone: (deal?.contact_phone || '').replace(/\D/g, ''),
      name: deal?.contact_name || deal?.title || 'Contato do card',
      is_group: false,
      is_archived: false,
      is_muted: false,
      unread_count: 0,
      created_at: deal?.created_at || new Date().toISOString(),
      updated_at: deal?.updated_at || new Date().toISOString(),
    }),
    [deal?.client_id, deal?.contact_phone, deal?.contact_name, deal?.title, deal?.created_at, deal?.updated_at],
  );

  const loading = open && (isLoading || isLoadingPhoneContact);

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:w-[460px] sm:max-w-[460px]">
          <VisuallyHidden>
            <SheetTitle>Detalhes do card</SheetTitle>
            <SheetDescription>Carregando dados do card</SheetDescription>
          </VisuallyHidden>
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full p-0 sm:w-[460px] sm:max-w-[460px] overflow-hidden flex flex-col"
      >
        <VisuallyHidden>
          <SheetTitle>Detalhes do card</SheetTitle>
          <SheetDescription>Informações do contato, do card no CRM e de telefonia</SheetDescription>
        </VisuallyHidden>
        <div className="flex-1 min-h-0">
          <WhatsAppDataProvider>
            {contactId ? (
              <ScopedDealRightBar
                contactId={contactId}
                conversationId={conv?.conversationId ?? null}
                queue={queueRow ?? null}
                onClose={() => onOpenChange(false)}
                crmContent={<DealDetailsSheet {...props} variant="inline" />}
              />
            ) : (
              <ChatRightBar
                contact={syntheticContact}
                onClose={() => onOpenChange(false)}
                className="h-full w-full border-l-0"
                initialTab="crm"
                visibleTabs={['contact', 'crm', 'phone']}
                crmContent={<DealDetailsSheet {...props} variant="inline" />}
                contactUnlinked
              />
            )}
          </WhatsAppDataProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScopedDealRightBar({
  contactId,
  conversationId,
  queue,
  onClose,
  crmContent,
}: {
  contactId: string;
  conversationId: string | null;
  queue: SelectedQueue | null;
  onClose: () => void;
  crmContent: React.ReactNode;
}) {
  const {
    selectedContact,
    selectContact,
    selectedContactId,
    selectedQueue,
    setSelectedQueue,
    upsertConversation,
  } = useWhatsAppData();

  const { data: dealContact } = useQuery({
    queryKey: ['deal-rightbar-contact', contactId],
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

  const { data: dealConversation } = useQuery({
    queryKey: ['deal-rightbar-conversation', conversationId],
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
    if (queue && selectedQueue?.id !== queue.id) setSelectedQueue(queue);
  }, [queue, selectedQueue?.id, setSelectedQueue]);

  useEffect(() => {
    if (selectedContactId !== contactId) selectContact(contactId);
  }, [contactId, selectedContactId, selectContact]);

  const contact = dealContact ?? selectedContact;

  if (!contact) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <ChatRightBar
      contact={contact}
      onClose={onClose}
      className="h-full w-full border-l-0"
      initialTab="crm"
      visibleTabs={['contact', 'crm', 'phone']}
      crmContent={crmContent}
    />
  );
}
