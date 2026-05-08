import { TvCard } from '../widgets/TvCard';
import { BigKpiCard } from '../widgets/BigKpiCard';
import { TvSparklineCard } from '../widgets/TvSparklineCard';
import {
  useReturnChatStats,
  useDbTopQueries,
  useDbCacheHitRatio,
  useReturnChatRunsTimeSeries,
} from '../../hooks/usePerformanceStats';
import { Gauge, Database, Zap, ListOrdered, Activity } from 'lucide-react';

function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}

function toneForMs(ms: number | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms <= 0) return 'neutral';
  if (ms < 200) return 'good';
  if (ms < 800) return 'warn';
  return 'bad';
}

function toneForRatio(r: number | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (r === undefined || r === null) return 'neutral';
  if (r >= 99) return 'good';
  if (r >= 95) return 'warn';
  return 'bad';
}

/**
 * Cena: Performance — latência do worker Retornar Chat e saúde de queries do banco.
 * Pensada para TV 4K: KPIs gigantes, série temporal e ranking das queries mais lentas.
 */
export function ScenePerformance() {
  const { data: stats } = useReturnChatStats();
  const { data: topQueries } = useDbTopQueries(8);
  const { data: cache } = useDbCacheHitRatio();
  const { data: series = [] } = useReturnChatRunsTimeSeries();

  const stats24h = stats?.find((s) => s.window_label === '24h');
  const stats7d = stats?.find((s) => s.window_label === '7d');

  const totalSeries = series.map((p) => p.duration_ms);
  const rpcSeries = series.map((p) => p.rpc_ms);

  return (
    <div className="grid grid-cols-12 gap-4 h-full content-start">
      {/* Linha 1 — KPIs gigantes */}
      <BigKpiCard
        label="RPC p50 · 24h"
        value={fmtMs(stats24h?.p50_rpc_ms)}
        tone={toneForMs(stats24h?.p50_rpc_ms)}
        className="col-span-3"
      />
      <BigKpiCard
        label="RPC p95 · 24h"
        value={fmtMs(stats24h?.p95_rpc_ms)}
        tone={toneForMs(stats24h?.p95_rpc_ms)}
        pulse
        className="col-span-3"
      />
      <BigKpiCard
        label="Total p95 · 24h"
        value={fmtMs(stats24h?.p95_total_ms)}
        tone={toneForMs(stats24h?.p95_total_ms)}
        className="col-span-3"
      />
      <BigKpiCard
        label="Cache hit (índices)"
        value={cache ? `${cache.index_hit_ratio}%` : '—'}
        tone={toneForRatio(cache?.index_hit_ratio)}
        className="col-span-3"
      />

      {/* Linha 2 — Série temporal das execuções */}
      <TvCard
        title="Latência do worker · últimos 60 minutos"
        className="col-span-7"
        rightSlot={
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <Activity className="h-4 w-4" />
            {series.length} execuções
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <TvSparklineCard
            label="Tempo total"
            value={fmtMs(totalSeries.at(-1))}
            data={totalSeries}
            color="#a78bfa"
            gradientId="perf-total"
          />
          <TvSparklineCard
            label="Tempo da RPC"
            value={fmtMs(rpcSeries.at(-1))}
            data={rpcSeries}
            color="#34d399"
            gradientId="perf-rpc"
          />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <Stat label="Execuções 24h" value={String(stats24h?.runs ?? 0)} />
          <Stat label="Candidatos 24h" value={String(stats24h?.candidates ?? 0)} />
          <Stat label="Processados 24h" value={String(stats24h?.processed ?? 0)} />
          <Stat label="Erros 24h" value={String(stats24h?.errors ?? 0)} tone={(stats24h?.errors ?? 0) > 0 ? 'bad' : 'good'} />
        </div>
      </TvCard>

      {/* Coluna direita — Janelas + cache */}
      <TvCard
        title="Resumo por janela"
        className="col-span-5"
        rightSlot={<Gauge className="h-5 w-5 text-zinc-500" />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
              <th className="text-left py-2">Janela</th>
              <th className="text-right">Runs</th>
              <th className="text-right">RPC p50</th>
              <th className="text-right">RPC p95</th>
              <th className="text-right">Total p95</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {[stats24h, stats7d].map((s, i) => (
              <tr key={i} className="text-zinc-200">
                <td className="py-3 font-semibold text-zinc-100">{s?.window_label ?? (i === 0 ? '24h' : '7d')}</td>
                <td className="text-right tabular-nums">{s?.runs ?? 0}</td>
                <td className="text-right tabular-nums text-emerald-300">{fmtMs(s?.p50_rpc_ms)}</td>
                <td className="text-right tabular-nums text-emerald-300">{fmtMs(s?.p95_rpc_ms)}</td>
                <td className="text-right tabular-nums text-violet-300">{fmtMs(s?.p95_total_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-zinc-900 p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Database className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">Heap hit</span>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${
              (cache?.heap_hit_ratio ?? 100) >= 99 ? 'text-emerald-300'
                : (cache?.heap_hit_ratio ?? 100) >= 95 ? 'text-amber-300' : 'text-rose-300'
            }`}>
              {cache ? `${cache.heap_hit_ratio}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-900 p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">Index hit</span>
            </div>
            <div className={`text-3xl font-bold tabular-nums ${
              (cache?.index_hit_ratio ?? 100) >= 99 ? 'text-emerald-300'
                : (cache?.index_hit_ratio ?? 100) >= 95 ? 'text-amber-300' : 'text-rose-300'
            }`}>
              {cache ? `${cache.index_hit_ratio}%` : '—'}
            </div>
          </div>
        </div>
      </TvCard>

      {/* Linha 3 — Top queries */}
      <TvCard
        title="Top queries por tempo médio"
        className="col-span-12"
        rightSlot={
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <ListOrdered className="h-4 w-4" />
            pg_stat_statements
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
              <th className="text-left py-2 w-[55%]">Consulta</th>
              <th className="text-right">Chamadas</th>
              <th className="text-right">Média</th>
              <th className="text-right">Total</th>
              <th className="text-right">Linhas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {(topQueries ?? []).map((q, i) => (
              <tr key={i} className="text-zinc-200">
                <td className="py-2 pr-4 font-mono text-[11px] text-zinc-300 truncate max-w-0">
                  <span className="line-clamp-1">{q.query}</span>
                </td>
                <td className="text-right tabular-nums">{Number(q.calls).toLocaleString('pt-BR')}</td>
                <td className={`text-right tabular-nums font-semibold ${
                  q.mean_ms >= 800 ? 'text-rose-300' : q.mean_ms >= 200 ? 'text-amber-300' : 'text-emerald-300'
                }`}>{fmtMs(q.mean_ms)}</td>
                <td className="text-right tabular-nums text-zinc-400">{fmtMs(q.total_ms)}</td>
                <td className="text-right tabular-nums text-zinc-500">{Number(q.rows_total).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {(!topQueries || topQueries.length === 0) && (
              <tr><td colSpan={5} className="text-center py-6 text-zinc-500 text-xs">
                Sem dados ainda — pg_stat_statements coletando…
              </td></tr>
            )}
          </tbody>
        </table>
      </TvCard>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-300' : tone === 'good' ? 'text-emerald-300' : 'text-zinc-100';
  return (
    <div className="rounded-lg bg-zinc-900 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}