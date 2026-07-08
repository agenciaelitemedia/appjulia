import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMDeal } from '../types';
import { getChatLink } from './useCardLinks';

export interface DealConversationInfo {
  conversationId: string;
  contactId: string;
  queueId: string | null;
  queueName: string | null;
  assignedTo: string | null;
  priority: string | null;
  status: string;
  protocol: string | null;
}

/**
 * Resolve conversation + contact + queue metadata para um deal vinculado ao chat.
 * Retorna null quando o deal não tem vínculo de chat.
 */
export function useDealConversation(deal: CRMDeal | null) {
  const chat = deal ? getChatLink(deal) : null;
  const conversationId = chat?.conversation_id ?? null;
  const contactIdFallback = chat?.contact_id ?? null;

  return useQuery({
    queryKey: ['deal-conversation', conversationId, contactIdFallback],
    enabled: !!conversationId || !!contactIdFallback,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DealConversationInfo | null> => {
      let conv: any = null;

      if (conversationId) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, contact_id, queue_id, assigned_to, priority, status, protocol')
          .eq('id', conversationId)
          .maybeSingle();
        if (error) {
          console.warn('[useDealConversation] lookup by id error', error);
        } else {
          conv = data;
        }
      }

      // Fallback: pinned conversation missing → resolve latest by contact_id
      if (!conv && contactIdFallback) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, contact_id, queue_id, assigned_to, priority, status, protocol')
          .eq('contact_id', contactIdFallback)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('[useDealConversation] lookup by contact_id error', error);
        } else {
          conv = data;
        }
      }

      if (!conv) return null;

      let queueName: string | null = null;
      if (conv.queue_id) {
        const { data: q } = await supabase
          .from('queues')
          .select('name, is_deleted')
          .eq('id', conv.queue_id)
          .maybeSingle();
        // Hide conversations whose queue was soft-deleted
        if (q?.is_deleted === true) return null;
        queueName = q?.name ?? null;
      }

      return {
        conversationId: conv.id,
        contactId: conv.contact_id,
        queueId: conv.queue_id ?? null,
        queueName,
        assignedTo: conv.assigned_to ?? null,
        priority: conv.priority ?? null,
        status: conv.status,
        protocol: conv.protocol ?? null,
      };
    },
  });
}