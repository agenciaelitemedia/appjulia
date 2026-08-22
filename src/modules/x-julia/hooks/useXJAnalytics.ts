/**
 * Agregados diários do X-Julia (tabela xj_analytics_daily, alimentada pelo rollup).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';

export interface XJAnalyticsDay {
  day: string;
  sessions_started: number;
  sessions_touched: number;
  turns: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  qualified: number;
  disqualified: number;
  handoffs: number;
  deals_created: number;
  contracts_sent: number;
  followups_sent: number;
  llm_errors: number;
  circuit_breaks: number;
}

export function useXJAnalyticsDaily(days = 30) {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJAnalyticsDay[]>({
    queryKey: ['x-julia', 'analytics-daily', clientId, days],
    enabled: !!clientId,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const from = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('xj_analytics_daily')
        .select('*')
        .eq('client_id', String(clientId))
        .gte('day', from)
        .order('day', { ascending: true });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        day: row.day,
        sessions_started: Number(row.sessions_started ?? 0),
        sessions_touched: Number(row.sessions_touched ?? 0),
        turns: Number(row.turns ?? 0),
        prompt_tokens: Number(row.prompt_tokens ?? 0),
        completion_tokens: Number(row.completion_tokens ?? 0),
        cost_usd: Number(row.cost_usd ?? 0),
        qualified: Number(row.qualified ?? 0),
        disqualified: Number(row.disqualified ?? 0),
        handoffs: Number(row.handoffs ?? 0),
        deals_created: Number(row.deals_created ?? 0),
        contracts_sent: Number(row.contracts_sent ?? 0),
        followups_sent: Number(row.followups_sent ?? 0),
        llm_errors: Number(row.llm_errors ?? 0),
        circuit_breaks: Number(row.circuit_breaks ?? 0),
      }));
    },
  });
}
