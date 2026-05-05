import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChatContact } from '@/types/chat';

/**
 * Loads `chat_contacts` rows by id in a single round-trip.
 * Used by the chat list to fill rows whose contact has not yet been
 * paginated into the local `contacts` cache but matches the active filters.
 */
export function useChatContactsByIds(ids: string[]) {
  // Stable cache key — sort to dedupe order changes.
  const sorted = [...new Set(ids)].sort();
  const key = sorted.join(',');
  return useQuery<ChatContact[]>({
    queryKey: ['chat-contacts-by-ids', key],
    enabled: sorted.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_contacts')
        .select(
          'id, client_id, cod_agent, channel_source, channel_type, remote_jid, phone, name, avatar, is_group, is_archived, is_muted, unread_count, last_message_at, last_message_text, created_at, updated_at'
        )
        .in('id', sorted);
      if (error) throw error;
      return (data || []) as unknown as ChatContact[];
    },
  });
}