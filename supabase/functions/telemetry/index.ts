import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { action, data } = await req.json();
    switch (action) {
      case 'log_device': {
        const { error } = await admin.from('user_device_log').insert(data);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'log_performance': {
        const { error } = await admin.from('user_performance_log').insert(data);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'get_device_latest': {
        const ids: number[] = Array.isArray(data?.userIds) ? data.userIds : [];
        if (ids.length === 0) return json({ data: [] });
        const { data: rows, error } = await admin
          .from('user_device_latest')
          .select('*')
          .in('user_id', ids);
        if (error) return json({ error: error.message }, 400);
        return json({ data: rows ?? [] });
      }
      case 'get_user_performance': {
        const userId = Number(data?.userId);
        if (!userId) return json({ data: [] });
        const { data: rows, error } = await admin
          .from('user_performance_log')
          .select('*')
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ data: rows ?? [] });
      }
      case 'get_dashboard': {
        const fromISO: string = data?.fromISO ?? new Date(Date.now() - 86400000).toISOString();
        const bucketMs: number = Number(data?.bucketMs) || 3600000;

        // Amostras de performance no período
        const { data: perfRows, error: perfErr } = await admin
          .from('user_performance_log')
          .select('user_id, client_id, route, ttfb_ms, fcp_ms, lcp_ms, cls, load_ms, js_heap_used_mb, net_effective_type, occurred_at')
          .gte('occurred_at', fromISO)
          .order('occurred_at', { ascending: false })
          .limit(20000);
        if (perfErr) return json({ error: perfErr.message }, 400);
        const perf = perfRows ?? [];

        // Sessões (device_log) no período
        const { count: sessions } = await admin
          .from('user_device_log')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', fromISO);

        // Composição atual da frota (último ambiente por usuário)
        const { data: devLatest } = await admin.from('user_device_latest').select('*');
        const devices = devLatest ?? [];

        const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
        const nums = (arr: any[], key: string): number[] =>
          arr.map((r) => num(r[key])).filter((n): n is number => n != null && Number.isFinite(n));
        const avg = (a: number[]): number | null => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
        const avg1 = (a: number[]): number | null => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
        const percentile = (a: number[], p: number): number | null => {
          if (!a.length) return null;
          const s = [...a].sort((x, y) => x - y);
          const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
          return Math.round(s[idx]);
        };
        const tally = (arr: any[], key: string): { name: string; count: number }[] => {
          const m = new Map<string, number>();
          for (const r of arr) { const k = r[key] ?? '—'; m.set(k, (m.get(k) ?? 0) + 1); }
          return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        };
        const isWeak = (d: any): boolean =>
          (d.cpu_cores != null && d.cpu_cores <= 2) ||
          (d.device_memory_gb != null && Number(d.device_memory_gb) <= 2) ||
          (d.net_effective_type && ['slow-2g', '2g', '3g'].includes(d.net_effective_type));

        const lcps = nums(perf, 'lcp_ms');
        const loads = nums(perf, 'load_ms');
        const fiveMinAgo = Date.now() - 5 * 60000;
        const activeNow = new Set(
          perf.filter((r) => new Date(r.occurred_at).getTime() >= fiveMinAgo).map((r) => r.user_id),
        ).size;
        const goodLcp = lcps.filter((v) => v <= 2500).length;

        // Série temporal por bucket
        const buckets = new Map<number, any[]>();
        for (const r of perf) {
          const t = Math.floor(new Date(r.occurred_at).getTime() / bucketMs) * bucketMs;
          if (!buckets.has(t)) buckets.set(t, []);
          buckets.get(t)!.push(r);
        }
        const timeseries = [...buckets.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([t, rows]) => ({
            t,
            lcpP75: percentile(nums(rows, 'lcp_ms'), 75),
            loadAvg: avg(nums(rows, 'load_ms')),
            heapAvg: avg1(nums(rows, 'js_heap_used_mb')),
            samples: rows.length,
          }));

        // Rotas mais lentas (LCP médio), min 2 amostras
        const routeMap = new Map<string, number[]>();
        for (const r of perf) {
          if (r.lcp_ms == null) continue;
          const k = r.route ?? '—';
          if (!routeMap.has(k)) routeMap.set(k, []);
          routeMap.get(k)!.push(Number(r.lcp_ms));
        }
        const slowRoutes = [...routeMap.entries()]
          .map(([route, v]) => ({ route, lcpAvg: avg(v)!, samples: v.length }))
          .filter((r) => r.samples >= 1)
          .sort((a, b) => b.lcpAvg - a.lcpAvg)
          .slice(0, 8);

        // Por cliente (multi-tenant)
        const clientMap = new Map<number, number[]>();
        for (const r of perf) {
          if (r.client_id == null) continue;
          if (!clientMap.has(r.client_id)) clientMap.set(r.client_id, []);
          if (r.lcp_ms != null) clientMap.get(r.client_id)!.push(Number(r.lcp_ms));
        }
        const weakByClient = new Map<number, number>();
        for (const d of devices) {
          if (d.client_id != null && isWeak(d)) weakByClient.set(d.client_id, (weakByClient.get(d.client_id) ?? 0) + 1);
        }
        const byClient = [...clientMap.entries()]
          .map(([client_id, v]) => ({ client_id, samples: v.length, lcpP75: percentile(v, 75) ?? 0, weak: weakByClient.get(client_id) ?? 0 }))
          .sort((a, b) => b.lcpP75 - a.lcpP75)
          .slice(0, 8);

        // Sessões lentas recentes
        const recentSlow = perf
          .filter((r) => r.lcp_ms != null)
          .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
          .filter((r) => Number(r.lcp_ms) > 2500)
          .slice(0, 12)
          .map((r) => ({ route: r.route, client_id: r.client_id, lcp_ms: r.lcp_ms, occurred_at: r.occurred_at }));

        return json({
          data: {
            generatedAt: new Date().toISOString(),
            kpis: {
              activeNow,
              sessions: sessions ?? 0,
              samples: perf.length,
              lcpP75: percentile(lcps, 75),
              lcpAvg: avg(lcps),
              loadP75: percentile(loads, 75),
              loadAvg: avg(loads),
              ttfbAvg: avg(nums(perf, 'ttfb_ms')),
              goodRate: lcps.length ? Math.round((goodLcp / lcps.length) * 100) : null,
              weakCount: devices.filter(isWeak).length,
              avgDownlink: avg1(nums(devices, 'net_downlink_mbps')),
              avgRtt: avg(nums(devices, 'net_rtt_ms')),
              avgHeap: avg1(nums(perf, 'js_heap_used_mb')),
            },
            timeseries,
            byBrowser: tally(devices, 'browser'),
            byOs: tally(devices, 'os'),
            byDevice: tally(devices, 'device_type'),
            byNetwork: tally(perf.filter((r) => r.net_effective_type), 'net_effective_type'),
            vitals: {
              good: lcps.filter((v) => v <= 2500).length,
              ni: lcps.filter((v) => v > 2500 && v <= 4000).length,
              poor: lcps.filter((v) => v > 4000).length,
            },
            slowRoutes,
            byClient,
            recentSlow,
          },
        });
      }
      default:
        return json({ error: 'unknown_action' }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});