import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PresenceUserMeta {
  user_id: number;
  user_name?: string | null;
  user_avatar?: string | null;
  online_at: string;
}

/**
 * Reads who is currently online in the same `client_id` presence channel.
 * Returns a Set of user_ids and the raw meta map.
 */
export function useTeamPresence() {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user?.client_id) {
      setOnlineIds(new Set());
      return;
    }
    const channel = supabase.channel(`presence:client:${user.client_id}`, {
      config: { presence: { key: `observer-${user.id}` } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, PresenceUserMeta[]>;
      const ids = new Set<number>();
      for (const arr of Object.values(state)) {
        for (const meta of arr) {
          if (meta?.user_id != null) ids.add(Number(meta.user_id));
        }
      }
      setOnlineIds(ids);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.client_id, user?.id]);

  return { onlineIds, isOnline: (uid: number) => onlineIds.has(Number(uid)) };
}