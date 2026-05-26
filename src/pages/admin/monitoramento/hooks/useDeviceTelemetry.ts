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
      const { data, error } = await (supabase as any)
        .from('user_device_latest')
        .select('*')
        .in('user_id', ids);
      if (error) throw error;
      const map: Record<number, DeviceInfo> = {};
      for (const row of ((data ?? []) as DeviceInfo[])) map[Number(row.user_id)] = row;
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
      const { data, error } = await (supabase as any)
        .from('user_performance_log')
        .select('*')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PerfRow[];
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
