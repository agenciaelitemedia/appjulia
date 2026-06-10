import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChatSidePanelTarget } from '@/components/chat/ChatSidePanel';
import type { SupportTicket } from '../types';

/**
 * Resolve a conversation target (contactId + queueId + conversationId) for a ticket.
 * Used to enable the "Enviar para WhatsApp" toggle when replying.
 */
export function useTicketChatTarget(ticket: SupportTicket | null | undefined) {
  return useQuery({
    queryKey: ['ticket-chat-target', ticket?.id, ticket?.conversation_id, ticket?.contact_id],
    enabled: !!ticket?.contact_id,
    staleTime: 60_000,
    queryFn: async (): Promise<ChatSidePanelTarget | null> => {
      if (!ticket?.contact_id) return null;
      let conversationId = ticket.conversation_id ?? null;
      let queueId: string | null = null;
      if (conversationId) {
        const { data } = await supabase
          .from('chat_conversations')
          .select('id, queue_id')
          .eq('id', conversationId)
          .maybeSingle();
        queueId = (data?.queue_id as string | null) ?? null;
      }
      if (!queueId) {
        const { data } = await supabase
          .from('chat_conversations')
          .select('id, queue_id')
          .eq('contact_id', ticket.contact_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          queueId = (data.queue_id as string | null) ?? null;
          if (!conversationId) conversationId = (data.id as string) ?? null;
        }
      }
      return { contactId: ticket.contact_id, queueId, conversationId };
    },
  });
}