import { useEffect, useMemo, useState } from 'react';
import { TvCard } from '../widgets/TvCard';
import { BigKpiCard } from '../widgets/BigKpiCard';
import { BarRanking } from '../widgets/BarRanking';
import { TvSparklineCard } from '../widgets/TvSparklineCard';
import {
  useInfraStats,
  useWebhookActivity,
  useMediaStats,
  useInfraTimeSeries,
} from '../../hooks/useInfraStats';
import { useDispatcherHealth } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { Database, Cloud, Webhook, Image as ImageIcon, Activity, LineChart } from 'lucide-react';

const FILTER_KEY = 'tv:infra:source-filter';

/**
 * Cena 4: Infraestrutura & Cloud — saúde do Lovable Cloud (Postgres),
 * webhooks recebidos, mídia trafegada e uptime do banco.
 */
export function SceneInfraCloud() {
  const { data: infra } = useInfraStats();
  const { data: webhooks } = useWebhookActivity();
  const { data: media } = useMediaStats();
  const { data: heartbeat } = useDispatcherHealth();

  // ---- Filtros de origem (persistidos)
  const [activeSources, setActiveSources] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify([...activeSources])); } catch {}
  }, [activeSources]);

  const allSources = useMemo(() => {
    const set = new Set<string>();
    for (const r of webhooks?.raw ?? []) set.add(r.source);
    return [...set].sort();
  }, [webhooks?.raw]);

  const filteredWebhooks = useMemo(() => {
    const raw = webhooks?.raw ?? [];
    const active = activeSources.size > 0
      ? raw.filter(r => activeSources.has(r.source))
      : raw;
    const since1h = Date.now() - 60 * 60 * 1000;
    const total_1h = active.filter(r => new Date(r.created_at).getTime() >= since1h).length;
    const forwarded = active.filter(r => r.forwarded).length;
    const map = new Map<string, number>();
    for (const r of active) map.set(r.source, (map.get(r.source) ?? 0) + 1);
    return {
      total_24h: active.length,
      total_1h,
      forwarded_24h: forwarded,
      per_source: [...map.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  }, [webhooks?.raw, activeSources]);

  // ---- Série temporal (60min)
  const series = useInfraTimeSeries({
    connections: infra?.connections_active,
    webhooksRaw: webhooks?.raw,
    mediaPerHour: media?.media_24h !== undefined ? media.media_24h / 24 : undefined,
  });

  const connSeries = series.map(p => p.connections);
  const webhookSeries = series.map(p => p.webhooks_per_min);
  const mediaSeries = series.map(p => p.media_per_min);

  function toggleSource(s: string) {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  // Tones
  const connTone = !infra
    ? 'neutral'
    : infra.connections_active > 50
    ? 'bad'
    : infra.connections_active > 20
    ? 'warn'
    : 'good';

  const oldestQuerySec = infra?.oldest_active_query_seconds ?? 0;
  const oldestQueryTone =
    oldestQuerySec > 30 ? 'bad' : oldestQuerySec > 5 ? 'warn' : 'good';

  const dispatcherTone = heartbeat?.is_offline
    ? 'bad'
    : heartbeat?.is_warning
    ? 'warn'
    : 'good';

  return (
    <div className="grid grid-cols-12 gap-4 h-full content-start">
      {/* Linha 1 — Big KPIs */}
      <BigKpiCard
        label="Tamanho do banco"
        value={infra?.db_size_pretty ?? '—'}
        tone="neutral"
        className="col-span-3"
      />
      <BigKpiCard
        label="Conexões ativas"
        value={infra?.connections_active ?? '—'}
        unit={infra ? `/ ${infra.connections_total} total` : ''}
        tone={connTone}
        className="col-span-3"
      />
      <BigKpiCard
        label="Uptime do banco"
        value={infra?.uptime_pretty ?? '—'}
        tone="good"
        className="col-span-3"
      />
      <BigKpiCard
        label="Query mais antiga"
        value={oldestQuerySec > 0 ? Math.round(oldestQuerySec) : 0}
        unit="seg"
        tone={oldestQueryTone}
        pulse
        className="col-span-3"
      />

      {/* Linha 2 — Webhooks por origem */}
      <TvCard
        title="Webhooks recebidos (24h) por origem"
        className="col-span-7"
        rightSlot={
          <div className="flex items-center gap-2 flex-wrap justify-end max-w-[60%]">
            {allSources.map(s => {
              const active = activeSources.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSource(s)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full transition ${
                    active
                      ? 'bg-violet-500/20 ring-1 ring-violet-400 text-violet-200'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              );
            })}
            {activeSources.size > 0 && (
              <button
                onClick={() => setActiveSources(new Set())}
                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-zinc-800 text-zinc-500 hover:text-zinc-200"
              >
                Limpar
              </button>
            )}
            <Webhook className="h-5 w-5 text-zinc-500" />
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-zinc-900 p-3 text-center">
            <div className="text-xs uppercase text-zinc-500">Total 24h</div>
            <div className="text-3xl font-bold tabular-nums text-zinc-100">
              {filteredWebhooks.total_24h.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-900 p-3 text-center">
            <div className="text-xs uppercase text-zinc-500">Última hora</div>
            <div className="text-3xl font-bold tabular-nums text-emerald-300">
              {filteredWebhooks.total_1h.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-900 p-3 text-center">
            <div className="text-xs uppercase text-zinc-500">Encaminhados</div>
            <div className="text-3xl font-bold tabular-nums text-violet-300">
              {filteredWebhooks.forwarded_24h.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
        <BarRanking
          items={filteredWebhooks.per_source.map((p) => ({
            id: p.source,
            label: p.source,
            value: p.count,
          }))}
          barColor="bg-violet-500"
        />
      </TvCard>

      {/* Mídia + Cloud info */}
      <TvCard
        title="Lovable Cloud"
        className="col-span-5"
        rightSlot={<Cloud className="h-5 w-5 text-zinc-500" />}
      >
        <div className="grid grid-cols-2 gap-3 h-full">
          <div className="rounded-lg bg-zinc-900 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">Mídia 24h</span>
            </div>
            <div className="text-4xl font-bold tabular-nums text-zinc-100">
              {(media?.media_24h ?? 0).toLocaleString('pt-BR')}
            </div>
            <div className="text-sm text-zinc-500">
              {media?.media_pct ?? 0}% das mensagens
            </div>
          </div>
          <div className="rounded-lg bg-zinc-900 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
              <Database className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">Conexões idle</span>
            </div>
            <div className="text-4xl font-bold tabular-nums text-zinc-100">
              {infra?.connections_idle ?? 0}
            </div>
            <div className="text-sm text-zinc-500">aguardando reuso</div>
          </div>
          <div className="rounded-lg bg-zinc-900 p-4 col-span-2 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">Dispatcher</span>
              </div>
              <div className={`text-2xl font-bold ${
                dispatcherTone === 'bad' ? 'text-rose-300' :
                dispatcherTone === 'warn' ? 'text-amber-300' : 'text-emerald-300'
              }`}>
                {heartbeat?.is_offline ? 'OFFLINE' : heartbeat?.is_warning ? 'ATENÇÃO' : 'OPERANDO'}
              </div>
            </div>
            <div className="text-right text-sm text-zinc-400">
              <div>{heartbeat?.workers_active ?? 0}/{heartbeat?.workers_max ?? 0} workers</div>
              <div className="tabular-nums">
                {heartbeat ? `${heartbeat.seconds_since_heartbeat}s desde ping` : 'sem heartbeat'}
              </div>
            </div>
          </div>
        </div>
      </TvCard>

      {/* Linha 3 — Série temporal 60min */}
      <TvCard
        title="Evolução · últimos 60 minutos"
        className="col-span-12"
        rightSlot={
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <LineChart className="h-4 w-4" />
            {series.length} pts
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <TvSparklineCard
            label="Conexões ativas"
            value={infra?.connections_active ?? '—'}
            data={connSeries}
            color="#60a5fa"
            gradientId="ts-conn"
          />
          <TvSparklineCard
            label="Webhooks / min"
            value={webhookSeries.at(-1) ?? 0}
            data={webhookSeries}
            color="#a78bfa"
            gradientId="ts-wh"
          />
          <TvSparklineCard
            label="Mídia / min"
            value={mediaSeries.at(-1) ?? 0}
            unit="aprox"
            data={mediaSeries}
            color="#fbbf24"
            gradientId="ts-media"
          />
        </div>
      </TvCard>
    </div>
  );
}