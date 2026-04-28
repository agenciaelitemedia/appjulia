import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { brPhoneVariants } from '@/lib/phoneNormalize';

export interface ChatContactStatus {
  hasContact: boolean;
  hasConversation: boolean;
  conversationId: string | null;
  status: string | null;
  protocol: string | null;
  queueId: string | null;
}

/**
 * Given a raw phone, checks if the chat module already knows this contact and,
 * if so, whether there's an active conversation (pending/open/closed).
 * Used by DealCard to choose between the green WhatsApp icon (linked chat) and
 * the amber WhatsApp icon (contact exists in CRM but not in chat yet).
 */
export function useChatContactConversationStatus(phone: string | null | undefined) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const variants = brPhoneVariants(phone);
  const norm = variants[0] ?? '';

  return useQuery({
    queryKey: ['chat-contact-status', clientId, norm],
    enabled: !!clientId && norm.length >= 8,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ChatContactStatus> => {
      const { data: contact } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('client_id', clientId)
        .in('phone', variants)
        .limit(1)
        .maybeSingle();

      if (!contact?.id) {
        return { hasContact: false, hasConversation: false, conversationId: null, status: null, protocol: null, queueId: null };
      }

      const { data: convList } = await supabase
        .from('chat_conversations')
        .select('id, status, protocol, queue_id, queues:queue_id(is_deleted)')
        .eq('client_id', clientId)
        .eq('contact_id', contact.id)
        .in('status', ['pending', 'open', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(5);
      // Ignore conversations whose queue was soft-deleted
      const conv = (convList || []).find((r: any) => !r?.queues || r.queues.is_deleted !== true) || null;

      return {
        hasContact: true,
        hasConversation: !!conv,
        conversationId: conv?.id ?? null,
        status: conv?.status ?? null,
        protocol: conv?.protocol ?? null,
        queueId: conv?.queue_id ?? null,
      };
    },
  });
}