import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PresenceUser {
  user_identifier: string;
  user_name?: string | null;
  user_avatar?: string | null;
  online_at: string;
}

/**
 * Tracks live presence of agents viewing a conversation using
 * Supabase Realtime presence (ephemeral, in-memory, no DB writes).
 */
export function useConversationPresence(
  conversationId: string | null | undefined,
  me: { id: string; name?: string | null; avatar?: string | null } | null,
) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!conversationId || !me?.id) {
      setUsers([]);
      return;
    }

    const channel = supabase.channel(`presence:conversation:${conversationId}`, {
      config: { presence: { key: me.id } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, Array<PresenceUser>>;
      const flat: PresenceUser[] = [];
      const seen = new Set<string>();
      for (const arr of Object.values(state)) {
        for (const item of arr) {
          if (seen.has(item.user_identifier)) continue;
          seen.add(item.user_identifier);
          flat.push(item);
        }
      }
      setUsers(flat);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_identifier: me.id,
            user_name: me.name || null,
            user_avatar: me.avatar || null,
            online_at: new Date().toISOString(),
          } satisfies PresenceUser);
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [conversationId, me?.id, me?.name, me?.avatar]);

  return users;
}
