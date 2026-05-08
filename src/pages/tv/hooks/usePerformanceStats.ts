import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReturnChatStat {
  window_label: string;
  runs: number;
  candidates: number;
  processed: number;
  errors: number;
  avg_total_ms: number;
  p50_total_ms: number;
  p95_total_ms: number;
  max_total_ms: number;
  avg_rpc_ms: number;
  p50_rpc_ms: number;
  p95_rpc_ms: number;
  max_rpc_ms: number;
}

export function useReturnChatStats() {
  return useQuery({
    queryKey: ['tv-return-chat-stats'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_return_chat_run_stats');
      if (error) throw error;
      return (data ?? []) as ReturnChatStat[];
    },
  });
}

export interface DbTopQuery {
  query: string;
  calls: number;
  total_ms: number;
  mean_ms: number;
  rows_total: number;
}

export function useDbTopQueries(limit = 10) {
  return useQuery({
    queryKey: ['tv-db-top-queries', limit],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_db_top_queries', { limit_rows: limit });
      if (error) throw error;
      return (data ?? []) as DbTopQuery[];
    },
  });
}

export interface DbCacheHitRatio {
  heap_hit_ratio: number;
  index_hit_ratio: number;
  measured_at: string;
}

export function useDbCacheHitRatio() {
  return useQuery({
    queryKey: ['tv-db-cache-hit-ratio'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_db_cache_hit_ratio');
      if (error) throw error;
      return ((data?.[0] ?? null) as DbCacheHitRatio | null);
    },
  });
}

export function useReturnChatRunsTimeSeries() {
  return useQuery({
    queryKey: ['tv-return-chat-runs-series'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('chat_return_chat_runs')
        .select('ran_at, duration_ms, rpc_ms')
        .gte('ran_at', since)
        .order('ran_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ ran_at: string; duration_ms: number; rpc_ms: number }>;
    },
  });
}