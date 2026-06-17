import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/lib/constants';

const SLOT_SECONDS = 30;
/** Coleta 1 slot a cada 30s e dá flush a cada 2 min (4 slots por chamada). */
const SLOT_INTERVAL_MS = SLOT_SECONDS * 1000;
const FLUSH_INTERVAL_MS = 2 * 60_000;
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
  const slotTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  const slotsRef = useRef<number[]>([]); // epoch seconds (rounded to 30s)

  useEffect(() => {
    if (!user?.id || !user?.client_id) return;
    const userId = Number(user.id);
    const clientId = Number(user.client_id);
    if (!Number.isFinite(userId) || !Number.isFinite(clientId)) return;

    let cancelled = false;

    const captureSlot = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!isUserActive()) return;
      const slot = Math.floor(Date.now() / 1000 / SLOT_SECONDS) * SLOT_SECONDS;
      const arr = slotsRef.current;
      if (arr.length === 0 || arr[arr.length - 1] !== slot) arr.push(slot);
    };

    const flush = async () => {
      if (cancelled || inflightRef.current) return;
      const pending = slotsRef.current;
      if (pending.length === 0) return;
      const batch = pending.splice(0, pending.length);
      inflightRef.current = true;
      try {
        await (supabase as any).rpc('touch_user_presence_batch', {
          p_user_id: userId,
          p_client_id: clientId,
          p_slots: batch.map((s) => new Date(s * 1000).toISOString()),
        });
      } catch {
        // Em caso de erro, devolve os slots para retry na próxima janela (cap em 20).
        slotsRef.current = batch.concat(slotsRef.current).slice(-20);
      } finally {
        inflightRef.current = false;
      }
    };

    // Limpeza explícita ao fechar/navegar — evita "online fantasma" por até 5 min.
    const clearViaBeacon = () => {
      // tenta liberar slots pendentes antes de sair (best-effort)
      void flush();
      try {
        const url = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/rest/v1/rpc/clear_user_presence`;
        const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
        if (!url || !apikey) return;
        // Usa fetch com keepalive + credentials:'omit' para evitar erro de CORS
        // ("Allow-Origin: *" não funciona com credentials:'include' que o sendBeacon força).
        void fetch(`${url}?apikey=${encodeURIComponent(apikey)}`, {
          method: 'POST',
          keepalive: true,
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            apikey,
            Authorization: `Bearer ${apikey}`,
          },
          body: JSON.stringify({ p_user_id: userId }),
        }).catch(() => {});
      } catch { /* ignore */ }
    };

    captureSlot();
    slotTimerRef.current = window.setInterval(captureSlot, SLOT_INTERVAL_MS);
    flushTimerRef.current = window.setInterval(flush, FLUSH_INTERVAL_MS);

    const onWake = () => { captureSlot(); void flush(); };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pagehide', clearViaBeacon);
    window.addEventListener('beforeunload', clearViaBeacon);

    return () => {
      cancelled = true;
      if (slotTimerRef.current != null) window.clearInterval(slotTimerRef.current);
      if (flushTimerRef.current != null) window.clearInterval(flushTimerRef.current);
      slotTimerRef.current = null;
      flushTimerRef.current = null;
      // flush final dos slots pendentes
      void flush();
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