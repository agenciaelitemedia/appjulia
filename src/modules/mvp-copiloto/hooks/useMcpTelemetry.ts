/**
 * Telemetria do conector MCP: agregações, últimas chamadas, detalhe por
 * request_id e limites de alerta do escritório.
 * Somente leitura via funções seguras do banco (isoladas por client_id).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';

export type McpWindow = '1h' | '24h' | '7d' | '30d' | 'custom';

export const MCP_WINDOW_HOURS: Record<Exclude<McpWindow, 'custom'>, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

export interface McpFilters {
  window: McpWindow;
  /** usados apenas quando window === 'custom' (YYYY-MM-DD) */
  fromDate?: string;
  toDate?: string;
  tool?: string;
  domain?: string;
  mode?: string;
  status?: string;
}

export function resolveRange(f: McpFilters): { from: Date; to: Date; bucket: 'hour' | 'day' } {
  if (f.window === 'custom' && f.fromDate && f.toDate) {
    const from = new Date(`${f.fromDate}T00:00:00`);
    const to = new Date(`${f.toDate}T23:59:59`);
    const hours = (to.getTime() - from.getTime()) / 3600_000;
    return { from, to, bucket: hours > 48 ? 'day' : 'hour' };
  }
  const key = (f.window === 'custom' ? '24h' : f.window) as Exclude<McpWindow, 'custom'>;
  const hours = MCP_WINDOW_HOURS[key];
  const to = new Date();
  return { from: new Date(to.getTime() - hours * 3600_000), to, bucket: hours > 48 ? 'day' : 'hour' };
}

export interface McpTotals {
  calls: number;
  errors: number;
  writes: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
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
  p99_ms: number;
  max_ms: number;
  top_error: string | null;
  top_dependency: string | null;
  last_call_at: string | null;
}

export interface McpErrorStat {
  error_code: string;
  calls: number;
  retryable: boolean;
  dependency: string | null;
  last_at: string | null;
}

export interface McpTimelinePoint {
  bucket: string;
  calls: number;
  errors: number;
  error_rate: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
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
  tool_version: string | null;
  mode: string;
  status: string;
  error_code: string | null;
  retryable: boolean | null;
  dependency: string | null;
  latency_ms: number;
  coverage_complete: boolean | null;
  coverage_warnings: number;
  result_count: number | null;
  dry_run: boolean | null;
  arg_keys: string[] | null;
  arg_summary: Record<string, unknown> | null;
  created_at: string;
}

export interface McpThreshold {
  id: string;
  client_id: string;
  tool_name: string | null;
  p95_limit_ms: number;
  error_rate_limit: number;
  min_volume: number;
  enabled: boolean;
}

export type AlertState = 'ok' | 'warning' | 'critical';

export interface McpAlert {
  tool_name: string;
  state: AlertState;
  reasons: string[];
}

const EMPTY_TOTALS: McpTotals = {
  calls: 0,
  errors: 0,
  writes: 0,
  error_rate: 0,
  p50_ms: 0,
  p95_ms: 0,
  p99_ms: 0,
  max_ms: 0,
  incomplete_coverage: 0,
};

function useClientId() {
  const { user } = useAuth();
  return user?.client_id ? String(user.client_id) : '';
}

export function useMcpStats(filters: McpFilters, autoRefresh: boolean) {
  const clientId = useClientId();

  return useQuery<McpStats>({
    queryKey: ['copiloto', 'mcp-stats', clientId, filters],
    enabled: !!clientId,
    refetchInterval: autoRefresh ? 30_000 : false,
    queryFn: async () => {
      const { from, to, bucket } = resolveRange(filters);
      const { data, error } = await supabase.rpc('cop_tool_call_stats', {
        p_client_id: clientId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_tool: filters.tool || null,
        p_domain: filters.domain || null,
        p_mode: filters.mode || null,
        p_status: filters.status || null,
        p_bucket: bucket,
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

/** Tendência diária dos últimos 30 dias (aba de saúde). */
export function useMcpDailyTrend(autoRefresh: boolean) {
  const clientId = useClientId();

  return useQuery<McpStats>({
    queryKey: ['copiloto', 'mcp-trend', clientId],
    enabled: !!clientId,
    refetchInterval: autoRefresh ? 60_000 : false,
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 3600_000);
      const { data, error } = await supabase.rpc('cop_tool_call_stats', {
        p_client_id: clientId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_tool: null,
        p_domain: null,
        p_mode: null,
        p_status: null,
        p_bucket: 'day',
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

export function useMcpRecentCalls(filters: McpFilters, autoRefresh: boolean, limit = 100) {
  const clientId = useClientId();

  return useQuery<McpRecentCall[]>({
    queryKey: ['copiloto', 'mcp-recent', clientId, filters, limit],
    enabled: !!clientId,
    refetchInterval: autoRefresh ? 30_000 : false,
    queryFn: async () => {
      const { from, to } = resolveRange(filters);
      const { data, error } = await supabase.rpc('cop_tool_call_recent', {
        p_client_id: clientId,
        p_limit: limit,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_tool: filters.tool || null,
        p_domain: filters.domain || null,
        p_mode: filters.mode || null,
        p_status: filters.status || null,
      });
      if (error) throw error;
      return (data || []) as McpRecentCall[];
    },
  });
}

export function useMcpCallDetail(requestId: string | null) {
  const clientId = useClientId();

  return useQuery<McpRecentCall | null>({
    queryKey: ['copiloto', 'mcp-call', clientId, requestId],
    enabled: !!clientId && !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cop_tool_call_detail', {
        p_client_id: clientId,
        p_request_id: requestId,
      });
      if (error) throw error;
      return (data || null) as McpRecentCall | null;
    },
  });
}

/* ---------------------------- limites de alerta ---------------------------- */

export const DEFAULT_THRESHOLD = { p95_limit_ms: 4000, error_rate_limit: 10, min_volume: 5, enabled: true };

export function useMcpThresholds() {
  const clientId = useClientId();

  return useQuery<McpThreshold[]>({
    queryKey: ['copiloto', 'mcp-thresholds', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cop_alert_thresholds')
        .select('id, client_id, tool_name, p95_limit_ms, error_rate_limit, min_volume, enabled')
        .eq('client_id', clientId)
        .order('tool_name', { nullsFirst: true });
      if (error) throw error;
      return (data || []) as McpThreshold[];
    },
  });
}

export function useSaveMcpThreshold() {
  const clientId = useClientId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      tool_name: string | null;
      p95_limit_ms: number;
      error_rate_limit: number;
      min_volume: number;
      enabled: boolean;
    }) => {
      const payload = { ...input, client_id: clientId };
      const { error } = await supabase
        .from('cop_alert_thresholds')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copiloto', 'mcp-thresholds', clientId] }),
  });
}

export function useDeleteMcpThreshold() {
  const clientId = useClientId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cop_alert_thresholds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copiloto', 'mcp-thresholds', clientId] }),
  });
}

/** Aplica os limites configurados sobre as métricas por tool. */
export function evaluateAlerts(tools: McpToolStat[], thresholds: McpThreshold[]): Map<string, McpAlert> {
  const map = new Map<string, McpAlert>();
  const fallback = thresholds.find((t) => !t.tool_name);

  for (const tool of tools) {
    const rule = thresholds.find((t) => t.tool_name === tool.tool_name) || fallback;
    if (!rule || !rule.enabled || tool.calls < (rule.min_volume ?? 5)) {
      map.set(tool.tool_name, { tool_name: tool.tool_name, state: 'ok', reasons: [] });
      continue;
    }
    const reasons: string[] = [];
    let state: AlertState = 'ok';
    const p95Limit = Number(rule.p95_limit_ms) || 0;
    const errLimit = Number(rule.error_rate_limit) || 0;

    if (p95Limit > 0) {
      if (tool.p95_ms > p95Limit) {
        state = 'critical';
        reasons.push(`p95 ${tool.p95_ms}ms > limite ${p95Limit}ms`);
      } else if (tool.p95_ms >= p95Limit * 0.8) {
        if (state !== 'critical') state = 'warning';
        reasons.push(`p95 ${tool.p95_ms}ms perto do limite ${p95Limit}ms`);
      }
    }
    if (errLimit > 0) {
      if (Number(tool.error_rate) > errLimit) {
        state = 'critical';
        reasons.push(`erro ${tool.error_rate}% > limite ${errLimit}%`);
      } else if (Number(tool.error_rate) >= errLimit * 0.8) {
        if (state !== 'critical') state = 'warning';
        reasons.push(`erro ${tool.error_rate}% perto do limite ${errLimit}%`);
      }
    }
    map.set(tool.tool_name, { tool_name: tool.tool_name, state, reasons });
  }
  return map;
}
