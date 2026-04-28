import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InfraStats {
  db_size_bytes: number;
  db_size_pretty: string;
  connections_active: number;
  connections_idle: number;
  connections_total: number;
  uptime_seconds: number;
  uptime_pretty: string;
  oldest_active_query_seconds: number;
}

function formatBytes(b: number): string {
  if (!b || b < 1024) return `${b ?? 0} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(s: number): string {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function useInfraStats() {
  return useQuery<InfraStats | null>({
    queryKey: ['tv-infra-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_infra_stats' as never);
      if (error || !data) return null;
      const d = data as any;
      return {
        db_size_bytes: Number(d.db_size_bytes ?? 0),
        db_size_pretty: formatBytes(Number(d.db_size_bytes ?? 0)),
        connections_active: Number(d.connections_active ?? 0),
        connections_idle: Number(d.connections_idle ?? 0),
        connections_total: Number(d.connections_total ?? 0),
        uptime_seconds: Number(d.uptime_seconds ?? 0),
        uptime_pretty: formatUptime(Number(d.uptime_seconds ?? 0)),
        oldest_active_query_seconds: Number(d.oldest_active_query_seconds ?? 0),
      };
    },
    refetchInterval: 30 * 1000,
  });
}

export interface WebhookActivity {
  total_24h: number;
  total_1h: number;
  forwarded_24h: number;
  per_source: { source: string; count: number }[];
}

export function useWebhookActivity() {
  return useQuery<WebhookActivity>({
    queryKey: ['tv-webhook-activity'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('webhook_logs' as never)
        .select('source, forwarded, created_at')
        .gte('created_at', since24h)
        .limit(5000) as any;
      const list = (data ?? []) as any[];
      const total_1h = list.filter(r => r.created_at >= since1h).length;
      const forwarded_24h = list.filter(r => r.forwarded === true).length;
      const map = new Map<string, number>();
      for (const r of list) {
        const s = r.source || 'desconhecido';
        map.set(s, (map.get(s) ?? 0) + 1);
      }
      return {
        total_24h: list.length,
        total_1h,
        forwarded_24h,
        per_source: Array.from(map.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      };
    },
    refetchInterval: 60 * 1000,
  });
}

export interface MediaStats {
  media_24h: number;
  total_messages_24h: number;
  media_pct: number;
}

export function useMediaStats() {
  return useQuery<MediaStats>({
    queryKey: ['tv-media-stats'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [totalRes, mediaRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since24h),
        supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since24h)
          .not('media_url', 'is', null),
      ]);
      const total = totalRes.count ?? 0;
      const media = mediaRes.count ?? 0;
      return {
        media_24h: media,
        total_messages_24h: total,
        media_pct: total > 0 ? Math.round((media / total) * 100) : 0,
      };
    },
    refetchInterval: 60 * 1000,
  });
}