import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCount { total: number; done: number; }

/**
 * Board-level task counts. Fetched once per board via React Query and cached
 * for 5 minutes — the previous implementation kept a *global* realtime
 * subscription on `crm_checklist_items` and refetched N items in `IN(…)` for
 * every checklist mutation anywhere in the tenant, which was catastrophic on
 * boards with 1000+ deals. The DealDetailsSheet invalidates this query
 * explicitly when the user edits checklist items.
 */
export function useCRMBoardTaskCounts(dealIds: string[]): Record<string, TaskCount> {
  // Stable key: sorted concatenation of deal ids so React Query dedupes
  // across renders where the array identity changed but content did not.
  const key = useMemo(() => {
    if (!dealIds.length) return '';
    return [...dealIds].sort().join(',');
  }, [dealIds]);

  const { data } = useQuery({
    queryKey: ['crm-board-task-counts', key],
    enabled: dealIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Record<string, TaskCount>> => {
      const map: Record<string, TaskCount> = {};
      // Chunk to avoid oversized IN() clauses on very large boards.
      const chunkSize = 500;
      for (let i = 0; i < dealIds.length; i += chunkSize) {
        const chunk = dealIds.slice(i, i + chunkSize);
        const { data: rows } = await supabase
          .from('crm_checklist_items')
          .select('deal_id, is_completed')
          .in('deal_id', chunk);
        for (const row of (rows || []) as { deal_id: string; is_completed: boolean }[]) {
          const c = (map[row.deal_id] ??= { total: 0, done: 0 });
          c.total++;
          if (row.is_completed) c.done++;
        }
      }
      return map;
    },
  });

  return data ?? {};
}
