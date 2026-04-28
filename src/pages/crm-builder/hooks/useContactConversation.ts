import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ContactConversationInfo {
  conversationId: string;
  status: 'pending' | 'open' | 'closed' | string;
  protocol: string | null;
  queueId: string | null;
}

/**
 * Looks up the most recent non-archived chat_conversation for a given contact_id
 * within the current client. Used to auto-link a CRM deal to a chat conversation
 * when the user picks an existing contact.
 */
export function useContactConversation(contactId: string | null | undefined) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery({
    queryKey: ['contact-conversation', clientId, contactId],
    enabled: !!clientId && !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<ContactConversationInfo | null> => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, status, protocol, queue_id, queues:queue_id(is_deleted)')
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .in('status', ['pending', 'open', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) return null;
      // Pick the most recent conversation whose queue is NOT soft-deleted
      const row = (data || []).find((r: any) => !r?.queues || r.queues.is_deleted !== true);
      if (!row) return null;
      return {
        conversationId: row.id,
        status: row.status,
        protocol: row.protocol ?? null,
        queueId: row.queue_id ?? null,
      };
    },
  });
}