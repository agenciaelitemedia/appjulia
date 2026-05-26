import { supabase } from '@/integrations/supabase/client';

export interface PagePerf {
  ttfb_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  dom_interactive_ms: number | null;
  load_ms: number | null;
  js_heap_used_mb: number | null;
  net_effective_type: string | null;
}

// Acumuladores atualizados pelos observers (LCP e CLS são contínuos).
let lcpMs: number | null = null;
let clsValue = 0;
let observersStarted = false;

/**
 * Registra os PerformanceObservers de LCP e CLS uma única vez.
 * LCP/CLS evoluem durante a vida da página; lemos os acumuladores no report.
 */
export function startPerformanceObservers(): void {
  if (observersStarted || typeof PerformanceObserver === 'undefined') return;
  observersStarted = true;

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) lcpMs = Math.round(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* não suportado */ }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* não suportado */ }
}

function readNavTiming(): { ttfb: number | null; domInteractive: number | null; load: number | null } {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return { ttfb: null, domInteractive: null, load: null };
    return {
      ttfb: nav.responseStart ? Math.round(nav.responseStart) : null,
      domInteractive: nav.domInteractive ? Math.round(nav.domInteractive) : null,
      load: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
    };
  } catch {
    return { ttfb: null, domInteractive: null, load: null };
  }
}

function readFcp(): number | null {
  try {
    const fcp = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
    return fcp ? Math.round(fcp.startTime) : null;
  } catch {
    return null;
  }
}

function readHeapMb(): number | null {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  if (!mem) return null;
  return Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10;
}

export function collectPagePerformance(): PagePerf {
  const nav = readNavTiming();
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return {
    ttfb_ms: nav.ttfb,
    fcp_ms: readFcp(),
    lcp_ms: lcpMs,
    cls: observersStarted ? Math.round(clsValue * 1000) / 1000 : null,
    dom_interactive_ms: nav.domInteractive,
    load_ms: nav.load,
    js_heap_used_mb: readHeapMb(),
    net_effective_type: conn?.effectiveType ?? null,
  };
}

export interface LogPerfParams {
  userId: number;
  clientId?: number | null;
  route: string;
  perf: PagePerf;
}

/**
 * Persiste métricas de performance em `user_performance_log`.
 * Falha silenciosamente — telemetria nunca deve quebrar o app.
 */
export async function logPagePerformance(params: LogPerfParams): Promise<void> {
  try {
    await (supabase as any).from('user_performance_log').insert({
      user_id: params.userId,
      client_id: params.clientId ?? null,
      route: params.route,
      ...params.perf,
    });
  } catch (err) {
    console.warn('[clientPerformance] failed', err);
  }
}
