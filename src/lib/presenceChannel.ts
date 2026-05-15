import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceMeta {
  user_id: number;
  user_name?: string | null;
  user_avatar?: string | null;
  online_at: string;
}

interface Entry {
  channel: RealtimeChannel;
  clientId: string;
  trackedKey: string | null;
  trackedMeta: PresenceMeta | null;
  listeners: Set<(ids: Set<number>) => void>;
  onlineIds: Set<number>;
  refCount: number;
}

const entries = new Map<string, Entry>();

function computeOnline(channel: RealtimeChannel): Set<number> {
  const state = channel.presenceState() as Record<string, PresenceMeta[]>;
  const ids = new Set<number>();
  for (const arr of Object.values(state)) {
    for (const m of arr) {
      if (m?.user_id != null) ids.add(Number(m.user_id));
    }
  }
  return ids;
}

let visibilityHookInstalled = false;
function ensureVisibilityHook() {
  if (visibilityHookInstalled || typeof window === 'undefined') return;
  visibilityHookInstalled = true;
  const reTrackAll = () => {
    for (const e of entries.values()) {
      if (e.trackedMeta) {
        const meta = { ...e.trackedMeta, online_at: new Date().toISOString() };
        e.trackedMeta = meta;
        try { void e.channel.track(meta); } catch { /* ignore */ }
      }
    }
  };
  window.addEventListener('focus', reTrackAll);
  window.addEventListener('online', reTrackAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reTrackAll();
  });
  // Heartbeat para manter presença viva e detectar quedas
  setInterval(reTrackAll, 25_000);
}

export function acquirePresence(clientId: string): Entry {
  ensureVisibilityHook();
  let e = entries.get(clientId);
  if (e) {
    e.refCount++;
    return e;
  }
  const channel = supabase.channel(`presence:client:${clientId}`, {
    config: { presence: { key: `c-${clientId}-${Math.random().toString(36).slice(2, 8)}` } },
  });

  e = {
    channel,
    clientId,
    trackedKey: null,
    trackedMeta: null,
    listeners: new Set(),
    onlineIds: new Set(),
    refCount: 1,
  };

  const sync = () => {
    e!.onlineIds = computeOnline(channel);
    for (const l of e!.listeners) l(e!.onlineIds);
  };

  channel
    .on('presence', { event: 'sync' }, sync)
    .on('presence', { event: 'join' }, sync)
    .on('presence', { event: 'leave' }, sync)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && e!.trackedMeta) {
        try { await channel.track(e!.trackedMeta); } catch { /* ignore */ }
        sync();
      }
    });

  entries.set(clientId, e);
  return e;
}

export function releasePresence(clientId: string) {
  const e = entries.get(clientId);
  if (!e) return;
  e.refCount--;
  if (e.refCount > 0) return;
  try { e.channel.untrack(); } catch { /* ignore */ }
  supabase.removeChannel(e.channel);
  entries.delete(clientId);
}

export async function trackPresence(clientId: string, meta: PresenceMeta) {
  const e = acquirePresence(clientId);
  e.trackedMeta = meta;
  e.trackedKey = String(meta.user_id);
  try {
    await e.channel.track(meta);
  } catch { /* will retry on subscribe */ }
}

export function subscribePresence(
  clientId: string,
  listener: (ids: Set<number>) => void,
): () => void {
  const e = acquirePresence(clientId);
  e.listeners.add(listener);
  // emit current state immediately
  listener(e.onlineIds);
  return () => {
    e.listeners.delete(listener);
    releasePresence(clientId);
  };
}
