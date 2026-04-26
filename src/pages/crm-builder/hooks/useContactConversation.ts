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
        .select('id, status, protocol, queue_id')
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .in('status', ['pending', 'open', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      if (!data) return null;
      return {
        conversationId: data.id,
        status: data.status,
        protocol: data.protocol ?? null,
        queueId: data.queue_id ?? null,
      };
    },
  });
}