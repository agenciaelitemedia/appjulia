import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeviceInfo {
  user_id: number;
  user_name: string | null;
  client_id: number | null;
  occurred_at: string;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  device_type: string | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  gpu_renderer: string | null;
  screen_w: number | null;
  screen_h: number | null;
  dpr: number | null;
  viewport_w: number | null;
  viewport_h: number | null;
  net_effective_type: string | null;
  net_downlink_mbps: number | null;
  net_rtt_ms: number | null;
  save_data: boolean | null;
  language: string | null;
  timezone: string | null;
  user_agent: string | null;
}

export interface PerfRow {
  id: string;
  user_id: number;
  occurred_at: string;
  route: string | null;
  ttfb_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  dom_interactive_ms: number | null;
  load_ms: number | null;
  js_heap_used_mb: number | null;
  net_effective_type: string | null;
}

/** Último snapshot de ambiente por usuário (view user_device_latest). */
export function useUserDeviceLatest(userIds: number[]) {
  const ids = [...new Set(userIds.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  return useQuery<Record<number, DeviceInfo>>({
    queryKey: ['user-device-latest', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: resp, error } = await supabase.functions.invoke('telemetry', {
        body: { action: 'get_device_latest', data: { userIds: ids } },
      });
      if (error) throw error;
      const map: Record<number, DeviceInfo> = {};
      for (const row of (((resp as any)?.data ?? []) as DeviceInfo[])) map[Number(row.user_id)] = row;
      return map;
    },
  });
}

/** Lista de user_ids que possuem dados de telemetria (com último acesso). */
export function useUsersWithTelemetry() {
  return useQuery<Map<number, string>>({
    queryKey: ['users-with-telemetry'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: resp, error } = await supabase.functions.invoke('telemetry', {
        body: { action: 'get_users_with_telemetry' },
      });
      if (error) throw error;
      const map = new Map<number, string>();
      for (const row of (((resp as any)?.data ?? []) as Array<{ user_id: number | string; occurred_at: string }>)) {
        map.set(Number(row.user_id), row.occurred_at);
      }
      return map;
    },
  });
}

/** Histórico recente de performance de um usuário. */
export function useUserPerformance(userId: number | null) {
  return useQuery<PerfRow[]>({
    queryKey: ['user-performance', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: resp, error } = await supabase.functions.invoke('telemetry', {
        body: { action: 'get_user_performance', data: { userId } },
      });
      if (error) throw error;
      return (((resp as any)?.data ?? []) as PerfRow[]);
    },
  });
}

// ── Dashboard agregado ──
export interface DashboardData {
  generatedAt: string;
  kpis: {
    activeNow: number;
    sessions: number;
    samples: number;
    lcpP75: number | null;
    lcpAvg: number | null;
    loadP75: number | null;
    loadAvg: number | null;
    ttfbAvg: number | null;
    goodRate: number | null;
    weakCount: number;
    avgDownlink: number | null;
    avgRtt: number | null;
    avgHeap: number | null;
  };
  timeseries: Array<{ t: number; lcpP75: number | null; loadAvg: number | null; heapAvg: number | null; samples: number }>;
  byBrowser: Array<{ name: string; count: number }>;
  byOs: Array<{ name: string; count: number }>;
  byDevice: Array<{ name: string; count: number }>;
  byNetwork: Array<{ name: string; count: number }>;
  vitals: { good: number; ni: number; poor: number };
  slowRoutes: Array<{ route: string; lcpAvg: number; samples: number }>;
  byClient: Array<{ client_id: number; samples: number; lcpP75: number; weak: number }>;
  recentSlow: Array<{ route: string | null; client_id: number | null; lcp_ms: number | null; occurred_at: string }>;
}

export type DashboardPeriod = '15m' | '1h' | '24h' | '7d' | '30d';

export const PERIODS: Record<DashboardPeriod, { label: string; ms: number; bucketMs: number }> = {
  '15m': { label: '15 min', ms: 15 * 60000, bucketMs: 60000 },
  '1h': { label: '1 hora', ms: 60 * 60000, bucketMs: 5 * 60000 },
  '24h': { label: '24 horas', ms: 24 * 3600000, bucketMs: 3600000 },
  '7d': { label: '7 dias', ms: 7 * 86400000, bucketMs: 6 * 3600000 },
  '30d': { label: '30 dias', ms: 30 * 86400000, bucketMs: 86400000 },
};

const EMPTY_DASHBOARD: DashboardData = {
  generatedAt: new Date(0).toISOString(),
  kpis: { activeNow: 0, sessions: 0, samples: 0, lcpP75: null, lcpAvg: null, loadP75: null, loadAvg: null, ttfbAvg: null, goodRate: null, weakCount: 0, avgDownlink: null, avgRtt: null, avgHeap: null },
  timeseries: [], byBrowser: [], byOs: [], byDevice: [], byNetwork: [],
  vitals: { good: 0, ni: 0, poor: 0 }, slowRoutes: [], byClient: [], recentSlow: [],
};

/** Dados agregados do dashboard para um período, com auto-refresh opcional. */
export function useTelemetryDashboard(period: DashboardPeriod, realtime: boolean) {
  const cfg = PERIODS[period];
  return useQuery<DashboardData>({
    queryKey: ['telemetry-dashboard', period],
    refetchInterval: realtime ? 10_000 : false,
    staleTime: 5_000,
    queryFn: async () => {
      const fromISO = new Date(Date.now() - cfg.ms).toISOString();
      const { data: resp, error } = await supabase.functions.invoke('telemetry', {
        body: { action: 'get_dashboard', data: { fromISO, bucketMs: cfg.bucketMs } },
      });
      // Degrada para vazio se a função ainda não foi redeployada (unknown_action).
      if (error || !(resp as any)?.data) return EMPTY_DASHBOARD;
      return (resp as any).data as DashboardData;
    },
  });
}

// ── Heurística de risco de lentidão ──
export function deviceIsWeak(d: DeviceInfo | undefined): boolean {
  if (!d) return false;
  if (d.cpu_cores != null && d.cpu_cores <= 2) return true;
  if (d.device_memory_gb != null && d.device_memory_gb <= 2) return true;
  if (d.net_effective_type && ['slow-2g', '2g', '3g'].includes(d.net_effective_type)) return true;
  return false;
}

export function avg(nums: Array<number | null>): number | null {
  const vals = nums.filter((n): n is number => n != null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
