/**
 * Telemetria do conector MCP: agregações e últimas chamadas do escritório.
 * Somente leitura, via funções seguras do banco (isoladas por client_id).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';

export type McpWindow = '1h' | '24h' | '7d' | '30d';

export const MCP_WINDOW_HOURS: Record<McpWindow, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

export interface McpTotals {
  calls: number;
  errors: number;
  writes: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  incomplete_coverage: number;
}

export interface McpToolStat {
  tool_name: string;
  domain: string | null;
  mode: string | null;
  calls: number;
  errors: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  last_call_at: string | null;
}

export interface McpErrorStat {
  error_code: string;
  calls: number;
  retryable: boolean;
  last_at: string | null;
}

export interface McpTimelinePoint {
  bucket: string;
  calls: number;
  errors: number;
  p95_ms: number | null;
}

export interface McpStats {
  totals: McpTotals;
  by_tool: McpToolStat[];
  by_error: McpErrorStat[];
  timeline: McpTimelinePoint[];
}

export interface McpRecentCall {
  request_id: string;
  tool_name: string;
  domain: string | null;
  mode: string;
  status: string;
  error_code: string | null;
  dependency: string | null;
  latency_ms: number;
  coverage_complete: boolean | null;
  coverage_warnings: number;
  result_count: number | null;
  dry_run: boolean | null;
  created_at: string;
}

const EMPTY_TOTALS: McpTotals = {
  calls: 0,
  errors: 0,
  writes: 0,
  error_rate: 0,
  p50_ms: 0,
  p95_ms: 0,
  max_ms: 0,
  incomplete_coverage: 0,
};

export function useMcpStats(window: McpWindow, autoRefresh: boolean) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<McpStats>({
    queryKey: ['copiloto', 'mcp-stats', clientId, window],
    enabled: !!clientId,
    refetchInterval: autoRefresh ? 30_000 : false,
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - MCP_WINDOW_HOURS[window] * 3600_000);
      const { data, error } = await supabase.rpc('cop_tool_call_stats', {
        p_client_id: clientId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      const raw = (data || {}) as Partial<McpStats>;
      return {
        totals: { ...EMPTY_TOTALS, ...(raw.totals || {}) },
        by_tool: raw.by_tool || [],
        by_error: raw.by_error || [],
        timeline: raw.timeline || [],
      };
    },
  });
}

export function useMcpRecentCalls(autoRefresh: boolean, limit = 50) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<McpRecentCall[]>({
    queryKey: ['copiloto', 'mcp-recent', clientId, limit],
    enabled: !!clientId,
    refetchInterval: autoRefresh ? 30_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cop_tool_call_recent', {
        p_client_id: clientId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data || []) as McpRecentCall[];
    },
  });
}
