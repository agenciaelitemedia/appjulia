import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { acquirePresence, releasePresence, trackPresence } from '@/lib/presenceChannel';

/**
 * Track global presence on a per-client singleton channel.
 */
export function useGlobalPresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !user?.client_id) return;
    const clientId = String(user.client_id);
    acquirePresence(clientId);
    void trackPresence(clientId, {
      user_id: Number(user.id),
      user_name: user.name,
      user_avatar: user.avatar || null,
      online_at: new Date().toISOString(),
    });
    return () => releasePresence(clientId);
  }, [user?.id, user?.client_id, user?.name, user?.avatar]);
}