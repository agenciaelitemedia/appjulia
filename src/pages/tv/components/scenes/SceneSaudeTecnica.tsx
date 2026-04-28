import { TvCard } from '../widgets/TvCard';
import { BigKpiCard } from '../widgets/BigKpiCard';
import { BarRanking } from '../widgets/BarRanking';
import { useDispatcherHealth, useUazapiPendingByClient } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { useChannelHealth } from '../../hooks/useTvAggregates';
import { Server, AlertOctagon, Zap } from 'lucide-react';

export function SceneSaudeTecnica() {
  const { data: heartbeat } = useDispatcherHealth();
  const { data: pendingByClient } = useUazapiPendingByClient();
  const { data: channels } = useChannelHealth();

  const workersActive = heartbeat?.workers_active ?? 0;
  const workersMax = heartbeat?.workers_max ?? 0;
  const workerSlots = Array.from({ length: workersMax }, (_, i) => i < workersActive);

  const dispatcherTone = heartbeat?.is_offline ? 'bad' : heartbeat?.is_warning ? 'warn' : 'good';
  const totalBacklog = (pendingByClient ?? []).reduce((a, p) => a + (p.pending_count || 0), 0);
  const itemsPerMin = heartbeat?.items_per_min ?? 0;
  const eta = totalBacklog > 0 && itemsPerMin > 0 ? Math.round(totalBacklog / itemsPerMin) : null;

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Linha 1: Big KPIs */}
      <BigKpiCard
        label="Heartbeat Dispatcher"
        value={heartbeat ? `${heartbeat.seconds_since_heartbeat}s` : '—'}
        tone={dispatcherTone}
        pulse
        className="col-span-3"
      />
      <BigKpiCard
        label="Items/min"
        value={Math.round(itemsPerMin)}
        tone={itemsPerMin > 10 ? 'good' : itemsPerMin > 0 ? 'warn' : 'bad'}
        className="col-span-3"
      />
      <BigKpiCard
        label="Workers ativos"
        value={`${workersActive}/${workersMax}`}
        tone={workersActive === workersMax ? 'good' : workersActive > 0 ? 'warn' : 'bad'}
        className="col-span-3"
      />
      <BigKpiCard
        label="ETA backlog"
        value={eta != null ? `${eta}` : '—'}
        unit={eta != null ? 'min' : ''}
        tone={eta == null ? 'good' : eta > 30 ? 'bad' : eta > 10 ? 'warn' : 'good'}
        className="col-span-3"
      />

      {/* Workers visualizados como dots */}
      <TvCard title="Worker Pool" className="col-span-5" rightSlot={<Server className="h-5 w-5 text-zinc-500" />}>
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-5 gap-3">
            {workerSlots.length > 0 ? workerSlots.map((active, i) => (
              <div
                key={i}
                className={`h-12 w-12 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-zinc-800'}`}
                title={`Worker ${i + 1} ${active ? 'ativo' : 'idle'}`}
              />
            )) : (
              <div className="text-zinc-500 col-span-5">Sem dispatcher rodando</div>
            )}
          </div>
        </div>
        <div className="text-center mt-4 text-sm text-zinc-400">
          {heartbeat?.total_processed_session != null && (
            <>Sessão: {heartbeat.total_processed_session.toLocaleString('pt-BR')} processados</>
          )}
        </div>
      </TvCard>

      {/* Saúde dos canais */}
      <TvCard title="Saúde dos Canais (24h)" className="col-span-7" rightSlot={<Zap className="h-5 w-5 text-zinc-500" />}>
        <div className="space-y-3">
          {(channels ?? []).map((ch) => (
            <div key={ch.channel} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${ch.error_pct > 5 ? 'bg-rose-500' : ch.error_pct > 1 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div>
                  <div className="text-lg font-semibold text-zinc-100">{ch.label}</div>
                  <div className="text-xs text-zinc-400">{ch.error_pct}% erro</div>
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums text-zinc-200">
                {ch.message_count_24h.toLocaleString('pt-BR')}
              </div>
            </div>
          ))}
          {(!channels || channels.length === 0) && (
            <div className="text-center text-zinc-500 py-8">Sem dados de canal</div>
          )}
        </div>
      </TvCard>

      {/* Backlog por cliente */}
      <TvCard title="Backlog por cliente (top 10)" className="col-span-12" rightSlot={<AlertOctagon className="h-5 w-5 text-zinc-500" />}>
        <BarRanking
          items={(pendingByClient ?? [])
            .sort((a, b) => (b.pending_count || 0) - (a.pending_count || 0))
            .slice(0, 10)
            .map((p) => {
              const oldestMin = p.oldest_pending_at
                ? Math.floor((Date.now() - new Date(p.oldest_pending_at).getTime()) / 60000)
                : null;
              return {
                id: p.client_id,
                label: p.client_name || `Cliente ${p.client_id}`,
                value: p.pending_count || 0,
                secondaryLabel: oldestMin != null ? `há ${oldestMin}min` : undefined,
              };
            })}
          barColor="bg-amber-500"
        />
      </TvCard>
    </div>
  );
}
