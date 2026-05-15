import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Persists a `last_seen_at` heartbeat in `user_presence` so the team dashboard
 * can show real online status even when the websocket suspends/reconnects.
 */
export function useHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !user?.client_id) return;
    const userId = Number(user.id);
    const clientId = Number(user.client_id);
    if (!Number.isFinite(userId) || !Number.isFinite(clientId)) return;

    let cancelled = false;

    const ping = async () => {
      if (cancelled || inflightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inflightRef.current = true;
      try {
        await supabase.from('user_presence').upsert(
          {
            user_id: userId,
            client_id: clientId,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      } catch {
        // ignore; next tick retries
      } finally {
        inflightRef.current = false;
      }
    };

    void ping();
    intervalRef.current = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);

    const onWake = () => { void ping(); };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      cancelled = true;
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [user?.id, user?.client_id]);
}