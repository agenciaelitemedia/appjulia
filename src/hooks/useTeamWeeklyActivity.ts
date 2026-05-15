import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyActivityResult {
  /** segundos online por user_id nos últimos 7 dias */
  onlineSecondsByUser: Record<number, number>;
  /** matriz 7×24 com minutos de presença agregados da equipe */
  heatmap: number[][];
  /** matriz 7×24 com nº de usuários distintos presentes naquela hora */
  heatmapUsers: number[][];
}

interface RawEvent {
  user_id: number;
  event_type: 'login' | 'logout_manual' | 'logout_inactivity';
  created_at: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function emptyMatrix(): number[][] {
  return Array.from({ length: 7 }, () => Array(24).fill(0));
}

/**
 * Pareia eventos login→logout por usuário (últimos 7 dias) e calcula:
 *  - tempo online por usuário
 *  - heatmap dia×hora de presença total (minutos) e usuários distintos
 */
export function useTeamWeeklyActivity(userIds: number[]) {
  const qc = useQueryClient();
  const ids = useMemo(
    () => [...new Set(userIds.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b),
    [userIds],
  );
  const queryKey = ['team-weekly-activity', ids.join(',')];

  const query = useQuery<WeeklyActivityResult>({
    queryKey,
    enabled: ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
      const { data, error } = await (supabase as any)
        .from('user_activity_log')
        .select('user_id,event_type,created_at')
        .in('user_id', ids)
        .gte('created_at', since)
        .order('user_id', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;

      const events = ((data ?? []) as RawEvent[]).map((e) => ({
        user_id: Number(e.user_id),
        event_type: e.event_type,
        ts: new Date(e.created_at).getTime(),
      }));

      const onlineSecondsByUser: Record<number, number> = {};
      const heatmap = emptyMatrix();
      const heatmapUsers = emptyMatrix();
      const userHourSet: Record<string, Set<number>> = {}; // key d-h -> set of users

      const sinceMs = Date.now() - SEVEN_DAYS_MS;
      const nowMs = Date.now();

      // agrupa por usuário
      const byUser = new Map<number, typeof events>();
      for (const ev of events) {
        if (!byUser.has(ev.user_id)) byUser.set(ev.user_id, []);
        byUser.get(ev.user_id)!.push(ev);
      }

      for (const uid of ids) {
        const list = byUser.get(uid) ?? [];
        let openLogin: number | null = null;

        // Se o primeiro evento é logout, assume sessão começando no início da janela
        if (list.length > 0 && list[0].event_type !== 'login') {
          openLogin = sinceMs;
        }

        for (const ev of list) {
          if (ev.event_type === 'login') {
            // se já havia login aberto, fecha implicitamente (descarta — sem logout pareado)
            openLogin = ev.ts;
          } else {
            // logout: fecha sessão
            const start = openLogin ?? ev.ts; // sem login → ignora
            if (openLogin !== null) {
              accumulate(uid, start, ev.ts);
              openLogin = null;
            }
          }
        }
        // se ainda online, fecha em now()
        if (openLogin !== null) {
          accumulate(uid, openLogin, nowMs);
        }
      }

      function accumulate(uid: number, startMs: number, endMs: number) {
        if (endMs <= startMs) return;
        const clampedStart = Math.max(startMs, sinceMs);
        const clampedEnd = Math.min(endMs, nowMs);
        if (clampedEnd <= clampedStart) return;

        onlineSecondsByUser[uid] = (onlineSecondsByUser[uid] ?? 0) + (clampedEnd - clampedStart) / 1000;

        // distribui em buckets de hora local
        let cursor = new Date(clampedStart);
        cursor.setMinutes(0, 0, 0);
        while (cursor.getTime() < clampedEnd) {
          const bucketStart = cursor.getTime();
          const bucketEnd = bucketStart + 3600_000;
          const overlap = Math.min(bucketEnd, clampedEnd) - Math.max(bucketStart, clampedStart);
          if (overlap > 0) {
            const d = new Date(Math.max(bucketStart, clampedStart)).getDay();
            const h = new Date(Math.max(bucketStart, clampedStart)).getHours();
            heatmap[d][h] += overlap / 60_000; // minutos
            const key = `${d}-${h}`;
            (userHourSet[key] ||= new Set()).add(uid);
          }
          cursor = new Date(bucketEnd);
        }
      }

      for (const key of Object.keys(userHourSet)) {
        const [d, h] = key.split('-').map(Number);
        heatmapUsers[d][h] = userHourSet[key].size;
      }

      // arredonda minutos
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) heatmap[d][h] = Math.round(heatmap[d][h]);
      }

      return { onlineSecondsByUser, heatmap, heatmapUsers };
    },
  });

  useEffect(() => {
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`weekly-activity:${ids.join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_activity_log' },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return query;
}