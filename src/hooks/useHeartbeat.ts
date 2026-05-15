import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/lib/constants';

const HEARTBEAT_INTERVAL_MS = 30_000;
/** Após 5 min sem interação (mouse/teclado), paramos de pingar — usuário fica "ausente". */
const ACTIVITY_GRACE_MS = 5 * 60_000;

function isUserActive(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_LAST_ACTIVITY);
    const last = raw ? Number(raw) : 0;
    if (!last) return false;
    return Date.now() - last < ACTIVITY_GRACE_MS;
  } catch {
    return false;
  }
}

/**
 * Persists a `last_seen_at` heartbeat in `user_presence` so the team dashboard
 * can show real online status even when the websocket suspends/reconnects.
 *
 * Online = aba visível **e** interação do usuário nos últimos 5 min.
 * Ausente = sem heartbeat entre 5 min e 30 min.
 * Offline = sem heartbeat por mais de 30 min.
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
      if (!isUserActive()) return;
      inflightRef.current = true;
      try {
        // Server-side timestamp evita clock skew do navegador.
        await (supabase as any).rpc('touch_user_presence', {
          p_user_id: userId,
          p_client_id: clientId,
        });
      } catch {
        // ignore; next tick retries
      } finally {
        inflightRef.current = false;
      }
    };

    // Limpeza explícita ao fechar/navegar — evita "online fantasma" por até 5 min.
    const clearViaBeacon = () => {
      try {
        const url = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/rest/v1/rpc/clear_user_presence`;
        const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
        if (!url || !apikey) return;
        const blob = new Blob([JSON.stringify({ p_user_id: userId })], { type: 'application/json' });
        // sendBeacon não permite headers customizados; embutimos apikey via querystring (PostgREST aceita).
        navigator.sendBeacon(`${url}?apikey=${encodeURIComponent(apikey)}`, blob);
      } catch { /* ignore */ }
    };

    void ping();
    intervalRef.current = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);

    const onWake = () => { void ping(); };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pagehide', clearViaBeacon);
    window.addEventListener('beforeunload', clearViaBeacon);

    return () => {
      cancelled = true;
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pagehide', clearViaBeacon);
      window.removeEventListener('beforeunload', clearViaBeacon);
      // Limpeza ao desmontar (logout / saída do MainLayout).
      void (supabase as any).rpc('clear_user_presence', { p_user_id: userId });
    };
  }, [user?.id, user?.client_id]);
}