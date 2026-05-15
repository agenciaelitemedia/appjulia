import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PresenceEntry {
  last_seen_at: string;
  is_online: boolean;
  is_away: boolean;
  seconds_since_seen: number;
}
export type PresenceMap = Record<number, PresenceEntry>;

/**
 * Reads the server-computed presence status (online/away/offline) for every
 * user in the same client. The server (`user_presence_status` view) decides
 * status based on `now() - last_seen_at`, removing client clock-skew bugs.
 */
export function useTeamHeartbeat() {
  const { user } = useAuth();
  const clientId = user?.client_id ? Number(user.client_id) : null;
  const qc = useQueryClient();
  const [, setNow] = useState(() => Date.now());

  const query = useQuery<PresenceMap>({
    queryKey: ['user_presence', clientId],
    enabled: clientId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_presence_status' as any)
        .select('user_id,last_seen_at,is_online,is_away,seconds_since_seen')
        .eq('client_id', clientId as number);
      if (error) throw error;
      const map: PresenceMap = {};
      for (const row of data || []) {
        const r = row as any;
        map[Number(r.user_id)] = {
          last_seen_at: r.last_seen_at,
          is_online: !!r.is_online,
          is_away: !!r.is_away,
          seconds_since_seen: Number(r.seconds_since_seen) || 0,
        };
      }
      return map;
    },
    staleTime: 10_000,
    refetchInterval: 30_000, // re-pesquisa o status calculado pelo servidor
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (clientId == null) return;
    const channel = supabase
      .channel(`user_presence:${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence', filter: `client_id=eq.${clientId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['user_presence', clientId] });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clientId, qc]);

  // Tick a cada 30s para envelhecer o rótulo "ativo há X" no UI.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const presence = query.data || {};
  const isOnline = (uid: number) => !!presence[Number(uid)]?.is_online;
  const isAway   = (uid: number) => !!presence[Number(uid)]?.is_away;
  const lastSeen = (uid: number) => presence[Number(uid)]?.last_seen_at ?? null;

  return { presence, isOnline, isAway, lastSeen };
}