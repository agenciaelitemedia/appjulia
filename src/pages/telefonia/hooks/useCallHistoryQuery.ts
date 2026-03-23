import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PhoneCallLog } from '../types';

export interface CallHistoryFilters {
  dateFrom: string;
  dateTo: string;
  direction?: string;
  cause?: string;
  page: number;
  pageSize: number;
}

interface CallHistoryResult {
  data: PhoneCallLog[];
  totalCount: number;
}

export function useCallHistoryQuery(
  codAgent: string | undefined,
  filters: CallHistoryFilters
) {
  return useQuery({
    queryKey: [
      'my-call-history',
      codAgent,
      filters.dateFrom,
      filters.dateTo,
      filters.direction,
      filters.cause,
      filters.page,
      filters.pageSize,
    ],
    queryFn: async (): Promise<CallHistoryResult> => {
      // Build date range with São Paulo timezone offset
      const fromISO = `${filters.dateFrom}T00:00:00-03:00`;
      const toISO = `${filters.dateTo}T23:59:59.999-03:00`;

      let query = supabase
        .from('phone_call_logs')
        .select('*', { count: 'exact' })
        .eq('cod_agent', codAgent!)
        .gte('started_at', fromISO)
        .lte('started_at', toISO);

      // Server-side direction filter
      if (filters.direction && filters.direction !== 'all') {
        query = query.eq('direction', filters.direction);
      }

      // Server-side hangup_cause filter
      if (filters.cause && filters.cause !== 'all') {
        query = query.eq('hangup_cause', filters.cause);
      }

      // Pagination
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      query = query
        .order('started_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: (data || []) as unknown as PhoneCallLog[],
        totalCount: count ?? 0,
      };
    },
    enabled: !!codAgent && !!filters.dateFrom && !!filters.dateTo,
    placeholderData: (prev) => prev,
  });
}
