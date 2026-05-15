import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribePresence } from '@/lib/presenceChannel';

/**
 * Reads who is currently online in the shared per-client presence channel.
 */
export function useTeamPresence() {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user?.client_id) {
      setOnlineIds(new Set());
      return;
    }
    const unsub = subscribePresence(String(user.client_id), (ids) => {
      setOnlineIds(new Set(ids));
    });
    return unsub;
  }, [user?.client_id]);

  return { onlineIds, isOnline: (uid: number) => onlineIds.has(Number(uid)) };
}