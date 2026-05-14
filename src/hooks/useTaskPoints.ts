import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { subWeeks, startOfWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PointsPeriod = 'week' | 'month' | 'all';

export interface RankingEntry {
  userId: string;
  userName: string;
  points: number;
  rank: number;
}

export interface WeeklyChartEntry {
  label: string;
  points: number;
}

const periodToSince = (period: PointsPeriod): string | null => {
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString();
  }
  return null;
};

export function useTaskPoints(clientId: string | undefined, period: PointsPeriod = 'month', myUserId?: string) {
  const since = periodToSince(period);

  const { data: rankingRaw = [], isLoading: rankingLoading } = useQuery<{ user_id: string; user_name: string; total_points: number }[]>({
    queryKey: ['task-ranking', clientId, period],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_task_ranking', {
        p_client_id: clientId!,
        p_since: since,
      });
      if (error) throw error;
      return (data ?? []) as { user_id: string; user_name: string; total_points: number }[];
    },
  });

  // Weekly chart: last 8 weeks
  const { data: ledgerRows = [], isLoading: ledgerLoading } = useQuery<{ created_at: string; points: number; user_id: string }[]>({
    queryKey: ['task-ledger-weekly', clientId, myUserId],
    enabled: !!clientId && !!myUserId,
    staleTime: 60_000,
    queryFn: async () => {
      const since8w = subWeeks(new Date(), 8).toISOString();
      const { data, error } = await supabase
        .from('task_points_ledger')
        .select('created_at, points, user_id')
        .eq('client_id', clientId!)
        .eq('user_id', myUserId!)
        .eq('action', 'earned')
        .gte('created_at', since8w)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as { created_at: string; points: number; user_id: string }[];
    },
  });

  const ranking: RankingEntry[] = useMemo(() =>
    rankingRaw.map((r, i) => ({
      userId: r.user_id,
      userName: r.user_name ?? r.user_id,
      points: Number(r.total_points),
      rank: i + 1,
    })),
  [rankingRaw]);

  const myEntry = myUserId ? ranking.find((r) => r.userId === String(myUserId)) : undefined;
  const myScore = myEntry?.points ?? 0;
  const myRank = myEntry?.rank ?? null;

  const weeklyChart: WeeklyChartEntry[] = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let w = 7; w >= 0; w--) {
      const d = subWeeks(new Date(), w);
      const key = format(startOfWeek(d, { locale: ptBR }), 'dd/MM');
      buckets[key] = 0;
    }
    for (const row of ledgerRows) {
      const key = format(startOfWeek(new Date(row.created_at), { locale: ptBR }), 'dd/MM');
      if (key in buckets) buckets[key] += row.points;
    }
    return Object.entries(buckets).map(([label, points]) => ({ label, points }));
  }, [ledgerRows]);

  return {
    ranking,
    myScore,
    myRank,
    weeklyChart,
    isLoading: rankingLoading || ledgerLoading,
  };
}
