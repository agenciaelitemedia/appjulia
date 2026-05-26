import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Activity, RefreshCw, Maximize2, Minimize2, Users, MousePointerClick,
  Gauge, ShieldAlert, Wifi, Cpu,
} from 'lucide-react';
import { BigKpiCard, type KpiTone } from '@/pages/tv/components/widgets/BigKpiCard';
import { TvCard } from '@/pages/tv/components/widgets/TvCard';
import { TvSparklineCard } from '@/pages/tv/components/widgets/TvSparklineCard';
import { BarRanking } from '@/pages/tv/components/widgets/BarRanking';
import {
  useTelemetryDashboard, PERIODS, type DashboardPeriod, type DashboardData,
} from '../hooks/useDeviceTelemetry';

const PERIOD_KEYS = Object.keys(PERIODS) as DashboardPeriod[];
const DONUT_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#a3e635'];

function fmtMs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}
function lcpTone(ms: number | null): KpiTone {
  if (ms == null) return 'neutral';
  if (ms <= 2500) return 'good';
  if (ms <= 4000) return 'warn';
  return 'bad';
}
function loadTone(ms: number | null): KpiTone {
  if (ms == null) return 'neutral';
  if (ms <= 3000) return 'good';
  if (ms <= 6000) return 'warn';
  return 'bad';
}
function rateTone(pct: number | null): KpiTone {
  if (pct == null) return 'neutral';
  if (pct >= 90) return 'good';
  if (pct >= 70) return 'warn';
  return 'bad';
}

const tooltipStyle = {
  background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8,
  color: '#fafafa', fontSize: 12,
};

function DonutCard({ title, data }: { title: string; data: Array<{ name: string; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <TvCard title={title} className="min-h-[220px]">
      {total === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-[10px] uppercase tracking-wider text-zinc-600">coletando…</div>
      ) : (
        <div className="flex items-center gap-2">
          <ResponsiveContainer width="50%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <RTooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.slice(0, 5).map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="truncate text-zinc-300 flex-1">{d.name}</span>
                <span className="tabular-nums text-zinc-400">{Math.round((d.count / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </TvCard>
  );
}

function bucketLabel(t: number, period: DashboardPeriod): string {
  if (period === '7d' || period === '30d') return format(new Date(t), 'dd/MM');
  return format(new Date(t), 'HH:mm');
}

export function TelemetryDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('24h');
  const [realtime, setRealtime] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching, refetch } = useTelemetryDashboard(period, realtime);
  const d: DashboardData | undefined = data;

  const toggleFs = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const series = useMemo(
    () => (d?.timeseries ?? []).map((p) => ({ ...p, label: bucketLabel(p.t, period) })),
    [d?.timeseries, period],
  );
  const k = d?.kpis;
  const vitalsTotal = d ? d.vitals.good + d.vitals.ni + d.vitals.poor : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'dark bg-zinc-950 text-zinc-100 rounded-2xl border border-zinc-800 overflow-y-auto',
        isFs ? 'p-8' : 'p-5',
      )}
      style={isFs ? { height: '100vh' } : undefined}
    >
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className={cn('absolute inline-flex h-2.5 w-2.5 rounded-full', realtime ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600')} />
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', realtime ? 'bg-emerald-500' : 'bg-zinc-600')} />
          </div>
          <div>
            <h2 className={cn('font-bold tracking-tight bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent', isFs ? 'text-3xl' : 'text-xl')}>
              Performance da Plataforma
            </h2>
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">
              {realtime ? 'AO VIVO' : 'PAUSADO'} · atualizado {d?.generatedAt && d.generatedAt !== new Date(0).toISOString() ? format(new Date(d.generatedAt), 'HH:mm:ss') : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de período */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
            {PERIOD_KEYS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  period === p ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                {PERIODS[p].label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRealtime((v) => !v)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
              realtime ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100')}
          >
            <Activity className="h-4 w-4" /> {realtime ? 'Ao vivo' : 'Pausado'}
          </button>
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
          <button onClick={toggleFs} className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100">
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isLoading && !d ? (
        <div className="text-center text-zinc-500 py-20 text-sm uppercase tracking-widest animate-pulse">Carregando telemetria…</div>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <BigKpiCard label="Usuários ativos" value={k?.activeNow ?? 0} tone={(k?.activeNow ?? 0) > 0 ? 'good' : 'neutral'} pulse={realtime} className={isFs ? '' : 'min-h-[140px]'} />
            <BigKpiCard label="Sessões no período" value={k?.sessions ?? 0} tone="neutral" className={isFs ? '' : 'min-h-[140px]'} />
            <BigKpiCard label="LCP p75" value={fmtMs(k?.lcpP75 ?? null)} tone={lcpTone(k?.lcpP75 ?? null)} className={isFs ? '' : 'min-h-[140px]'} />
            <BigKpiCard label="Carga média" value={fmtMs(k?.loadAvg ?? null)} tone={loadTone(k?.loadAvg ?? null)} className={isFs ? '' : 'min-h-[140px]'} />
            <BigKpiCard label="Web Vitals bom" value={k?.goodRate != null ? `${k.goodRate}%` : '—'} tone={rateTone(k?.goodRate ?? null)} className={isFs ? '' : 'min-h-[140px]'} />
            <BigKpiCard label="Em risco" value={k?.weakCount ?? 0} tone={(k?.weakCount ?? 0) > 0 ? 'bad' : 'good'} pulse className={isFs ? '' : 'min-h-[140px]'} />
          </div>

          {/* Série temporal + sparklines */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TvCard title={`Performance ao longo do tempo · ${PERIODS[period].label}`} className="lg:col-span-2 min-h-[300px]"
              rightSlot={<span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1"><Gauge className="h-4 w-4" />{d?.kpis.samples ?? 0} amostras</span>}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-lcp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-load" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 100) / 10}s`} />
                  <RTooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtMs(v), n === 'lcpP75' ? 'LCP p75' : 'Carga']} />
                  <Area type="monotone" dataKey="lcpP75" stroke="#22d3ee" strokeWidth={2} fill="url(#g-lcp)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="loadAvg" stroke="#a78bfa" strokeWidth={2} fill="url(#g-load)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </TvCard>

            <div className="grid grid-rows-2 gap-4">
              <TvSparklineCard label="LCP p75 (tendência)" value={fmtMs(series.at(-1)?.lcpP75 ?? null)} data={series.map((s) => s.lcpP75 ?? 0)} color="#22d3ee" gradientId="sp-lcp" />
              <TvSparklineCard label="Heap JS médio" value={k?.avgHeap != null ? `${k.avgHeap}` : '—'} unit="MB" data={series.map((s) => s.heapAvg ?? 0)} color="#34d399" gradientId="sp-heap" />
            </div>
          </div>

          {/* Volume + Core Web Vitals + Rede */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TvCard title="Volume de amostras" className="min-h-[220px]">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'amostras']} />
                  <Bar dataKey="samples" fill="#60a5fa" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </TvCard>

            <TvCard title="Core Web Vitals (LCP)" className="min-h-[220px]">
              <div className="flex flex-col justify-center h-full gap-4">
                <div className="flex h-5 rounded-full overflow-hidden bg-zinc-800">
                  {vitalsTotal > 0 && (<>
                    <div className="bg-emerald-500" style={{ width: `${(d!.vitals.good / vitalsTotal) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(d!.vitals.ni / vitalsTotal) * 100}%` }} />
                    <div className="bg-rose-500" style={{ width: `${(d!.vitals.poor / vitalsTotal) * 100}%` }} />
                  </>)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-2xl font-bold tabular-nums text-emerald-300">{d?.vitals.good ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500">Bom ≤2.5s</p></div>
                  <div><p className="text-2xl font-bold tabular-nums text-amber-300">{d?.vitals.ni ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500">A melhorar</p></div>
                  <div><p className="text-2xl font-bold tabular-nums text-rose-300">{d?.vitals.poor ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500">Ruim &gt;4s</p></div>
                </div>
              </div>
            </TvCard>

            <TvCard title="Saúde de rede" className="min-h-[220px]">
              <div className="grid grid-cols-2 gap-3 h-full content-center">
                <div className="rounded-lg bg-zinc-900 p-4 text-center">
                  <Wifi className="h-5 w-5 mx-auto text-cyan-400 mb-1" />
                  <p className="text-3xl font-bold tabular-nums text-zinc-100">{k?.avgDownlink ?? '—'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Mbps médio</p>
                </div>
                <div className="rounded-lg bg-zinc-900 p-4 text-center">
                  <Activity className="h-5 w-5 mx-auto text-violet-400 mb-1" />
                  <p className="text-3xl font-bold tabular-nums text-zinc-100">{k?.avgRtt ?? '—'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">RTT (ms)</p>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <MousePointerClick className="h-3.5 w-3.5" /> TTFB médio: <span className="text-zinc-200 tabular-nums">{fmtMs(k?.ttfbAvg ?? null)}</span>
                </div>
              </div>
            </TvCard>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <DonutCard title="Navegador" data={d?.byBrowser ?? []} />
            <DonutCard title="Sistema operacional" data={d?.byOs ?? []} />
            <DonutCard title="Tipo de dispositivo" data={d?.byDevice ?? []} />
            <DonutCard title="Tipo de rede" data={d?.byNetwork ?? []} />
          </div>

          {/* Rotas lentas + por cliente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TvCard title="Rotas mais lentas (LCP médio)" className="min-h-[220px]" rightSlot={<Gauge className="h-4 w-4 text-zinc-500" />}>
              <BarRanking
                barColor="bg-cyan-500"
                items={(d?.slowRoutes ?? []).map((r) => ({ id: r.route, label: r.route, value: r.lcpAvg, secondaryLabel: `${r.samples}x`, trail: 'ms' }))}
              />
            </TvCard>
            <TvCard title="Pior performance por escritório" className="min-h-[220px]" rightSlot={<ShieldAlert className="h-4 w-4 text-zinc-500" />}>
              <BarRanking
                barColor="bg-violet-500"
                items={(d?.byClient ?? []).map((c) => ({ id: String(c.client_id), label: `Escritório #${c.client_id}`, value: c.lcpP75, secondaryLabel: `${c.samples} amostras${c.weak ? ` · ${c.weak} fracos` : ''}`, trail: 'ms p75' }))}
              />
            </TvCard>
          </div>

          {/* Sessões lentas recentes */}
          <TvCard title="Sessões lentas recentes (LCP > 2.5s)" rightSlot={<Cpu className="h-4 w-4 text-zinc-500" />}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
                  <th className="text-left py-2">Rota</th>
                  <th className="text-left">Escritório</th>
                  <th className="text-right">LCP</th>
                  <th className="text-right">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(d?.recentSlow ?? []).map((r, i) => (
                  <tr key={i} className="text-zinc-200">
                    <td className="py-2 font-mono text-[12px] text-zinc-300 truncate max-w-0"><span className="line-clamp-1">{r.route ?? '—'}</span></td>
                    <td className="text-zinc-400 text-xs">{r.client_id != null ? `#${r.client_id}` : '—'}</td>
                    <td className={cn('text-right tabular-nums font-semibold', (r.lcp_ms ?? 0) > 4000 ? 'text-rose-300' : 'text-amber-300')}>{fmtMs(r.lcp_ms ?? null)}</td>
                    <td className="text-right tabular-nums text-zinc-500">{format(new Date(r.occurred_at), 'dd/MM HH:mm')}</td>
                  </tr>
                ))}
                {(!d?.recentSlow || d.recentSlow.length === 0) && (
                  <tr><td colSpan={4} className="text-center py-6 text-zinc-500 text-xs">Nenhuma sessão lenta no período 🎉</td></tr>
                )}
              </tbody>
            </table>
          </TvCard>
        </div>
      )}
    </div>
  );
}
