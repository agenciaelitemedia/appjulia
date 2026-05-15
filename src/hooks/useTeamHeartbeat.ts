import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type PresenceMap = Record<number, string>; // user_id -> last_seen_at ISO

const ONLINE_WINDOW_MS = 75_000;

/**
 * Reads the heartbeat-based last_seen_at for every user in the same client.
 * Combines DB realtime + a 30s tick so the "ativo há X" label keeps aging.
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
        .from('user_presence')
        .select('user_id,last_seen_at')
        .eq('client_id', clientId as number);
      if (error) throw error;
      const map: PresenceMap = {};
      for (const row of data || []) {
        map[Number((row as any).user_id)] = (row as any).last_seen_at;
      }
      return map;
    },
    staleTime: 15_000,
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

  // Tick every 30s to refresh "ativo há X min" labels and re-evaluate online window
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const presence = query.data || {};
  const isFresh = (uid: number) => {
    const ts = presence[Number(uid)];
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < ONLINE_WINDOW_MS;
  };

  return { presence, isFresh };
}