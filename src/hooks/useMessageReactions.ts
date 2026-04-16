import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageReaction {
  id: string;
  message_id: string;
  external_message_id: string | null;
  reactor: string;
  emoji: string;
  from_me: boolean;
  created_at: string;
}

/**
 * Subscribes to chat_message_reactions for a list of message ids.
 * Returns map of message_id -> reactions[].
 */
export function useMessageReactions(messageIds: string[]) {
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, MessageReaction[]>>({});

  const load = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('chat_message_reactions')
      .select('*')
      .in('message_id', ids);
    const map: Record<string, MessageReaction[]> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r as MessageReaction);
    });
    setReactionsByMsg(map);
  }, []);

  useEffect(() => {
    load(messageIds);
  }, [messageIds.join('|'), load]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('chat_message_reactions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.message_id || !messageIds.includes(row.message_id)) return;
          // Reload reactions for this message
          supabase
            .from('chat_message_reactions')
            .select('*')
            .eq('message_id', row.message_id)
            .then(({ data }) => {
              setReactionsByMsg((prev) => ({
                ...prev,
                [row.message_id]: (data || []) as MessageReaction[],
              }));
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageIds.join('|')]);

  return { reactionsByMsg, refresh: () => load(messageIds) };
}

export async function sendReaction(params: {
  message_id: string;
  external_message_id?: string;
  emoji: string;
  queue_id: string;
  contact_phone: string;
  reactor: string;
  from_me?: boolean;
}) {
  return supabase.functions.invoke('chat-message-react', { body: params });
}
