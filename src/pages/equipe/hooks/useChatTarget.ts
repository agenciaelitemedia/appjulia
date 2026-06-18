import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { brPhoneVariants } from '@/lib/phoneNormalize';
import type { ChatSidePanelTarget } from '@/components/chat/ChatSidePanel';

/**
 * Resolve um ChatSidePanelTarget a partir de um conversation_id.
 * Usa chat_conversations para extrair contact_id e queue_id.
 */
export function useChatTargetByConversation(conversationId: string | null, enabled: boolean) {
  const { user } = useAuth();
  const clientIdText = user?.client_id ? String(user.client_id) : '';
  return useQuery<ChatSidePanelTarget | null>({
    queryKey: ['chat-target-by-conversation', clientIdText, conversationId],
    enabled: enabled && !!conversationId && !!clientIdText,
    staleTime: 60_000,
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, contact_id, queue_id')
        .eq('client_id', clientIdText)
        .eq('id', conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.contact_id) return null;
      return {
        contactId: data.contact_id,
        queueId: data.queue_id ?? null,
        conversationId: data.id,
      };
    },
  });
}

/**
 * Resolve um ChatSidePanelTarget a partir de um telefone.
 * 1) Busca contato em chat_contacts por phone (variações BR).
 * 2) Busca conversa mais recente desse contato.
 */
export function useChatTargetByPhone(phone: string | null, enabled: boolean) {
  const { user } = useAuth();
  const clientIdText = user?.client_id ? String(user.client_id) : '';
  return useQuery<ChatSidePanelTarget | null>({
    queryKey: ['chat-target-by-phone', clientIdText, phone],
    enabled: enabled && !!phone && !!clientIdText,
    staleTime: 60_000,
    queryFn: async () => {
      if (!phone) return null;
      const variants = brPhoneVariants(phone);
      if (variants.length === 0) return null;

      const { data: contacts, error: errC } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('client_id', clientIdText)
        .in('phone', variants)
        .limit(5);
      if (errC) throw errC;
      const contactIds = (contacts || []).map((c: any) => c.id).filter(Boolean);
      if (contactIds.length === 0) return null;

      const { data: convs, error: errV } = await supabase
        .from('chat_conversations')
        .select('id, contact_id, queue_id, last_message_at, created_at')
        .eq('client_id', clientIdText)
        .in('contact_id', contactIds)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (errV) throw errV;
      const conv = (convs || [])[0] as any;
      if (!conv) {
        return { contactId: contactIds[0], queueId: null, conversationId: null };
      }
      return {
        contactId: conv.contact_id,
        queueId: conv.queue_id ?? null,
        conversationId: conv.id,
      };
    },
  });
}