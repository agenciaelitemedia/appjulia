import { useEffect, useState } from 'react';
import { HealthBadge, type HealthState } from './widgets/HealthBadge';
import { useDispatcherHealth, useUazapiPendingByClient } from '@/pages/configuracoes/hooks/useUazapiHistoryRuns';
import { useGlobalSlaStats } from '../hooks/useGlobalSlaStats';
import { useChurnSignals } from '../hooks/useChurnSignals';
import { Activity } from 'lucide-react';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function TvHeaderStrip() {
  const clock = useClock();
  const { data: heartbeat } = useDispatcherHealth();
  const { data: pendingByClient } = useUazapiPendingByClient();
  const { data: slaStats } = useGlobalSlaStats();
  const { data: churn } = useChurnSignals();

  // Julia status
  const juliaState: HealthState = heartbeat?.is_offline ? 'bad' : heartbeat?.is_warning ? 'warn' : 'good';
  const juliaPrimary = heartbeat ? `${heartbeat.seconds_since_heartbeat}s` : '—';
  const juliaSecondary = heartbeat
    ? heartbeat.is_offline ? 'OFFLINE — sem ping >5min'
    : heartbeat.is_warning ? 'Atenção — ping atrasado'
    : `${heartbeat.workers_active}/${heartbeat.workers_max} workers`
    : 'sem heartbeat';

  // Backlog total
  const totalBacklog = (pendingByClient ?? []).reduce((a, p) => a + (p.pending_count || 0), 0);
  const backlogState: HealthState = totalBacklog > 500 ? 'bad' : totalBacklog > 100 ? 'warn' : 'good';
  const oldestPending = (pendingByClient ?? [])
    .map(p => p.oldest_pending_at)
    .filter(Boolean)
    .sort()[0];
  const oldestPendingMin = oldestPending
    ? Math.floor((Date.now() - new Date(oldestPending).getTime()) / 60000)
    : null;

  // SLA
  const slaBreached = slaStats?.breached ?? 0;
  const slaState: HealthState = slaBreached > 5 ? 'bad' : slaBreached > 0 ? 'warn' : 'good';
  const slaSecondary = slaStats?.oldest_breached
    ? `Mais antigo: ${slaStats.oldest_breached.minutes_overdue}min atrasado`
    : `${slaStats?.at_risk ?? 0} em risco`;

  // Churn
  const churnTotal = churn?.total ?? 0;
  const churnState: HealthState = churnTotal > 5 ? 'bad' : churnTotal > 0 ? 'warn' : 'good';
  const churnSecondary = churn?.signals?.[0]?.snippet || 'Nenhum sinal recente';

  // Webhooks (proxy: ratio de erros do dispatcher)
  const webhookState: HealthState = juliaState; // mesmo critério por ora
  const webhookPrimary = heartbeat?.items_per_min != null ? `${Math.round(heartbeat.items_per_min)}` : '—';
  const webhookSecondary = 'msgs/min';

  return (
    <div className="flex items-stretch gap-4">
      <HealthBadge label="Julia" state={juliaState} primary={juliaPrimary} secondary={juliaSecondary} pulse className="flex-1" />
      <HealthBadge label="Webhooks" state={webhookState} primary={webhookPrimary} secondary={webhookSecondary} className="flex-1" />
      <HealthBadge label="SLA Violado" state={slaState} primary={slaBreached} secondary={slaSecondary} pulse className="flex-1" />
      <HealthBadge label="Churn (4h)" state={churnState} primary={churnTotal} secondary={churnSecondary} className="flex-1" />
      <HealthBadge
        label="Backlog"
        state={backlogState}
        primary={totalBacklog.toLocaleString('pt-BR')}
        secondary={oldestPendingMin != null ? `+${oldestPendingMin}min` : 'sem fila'}
        className="flex-1"
      />
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col items-center justify-center min-w-[220px]">
        <div className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-1">
          <Activity className="h-3 w-3" /> Em tempo real
        </div>
        <div className="text-5xl font-bold tabular-nums text-zinc-100">
          {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-sm text-zinc-400">
          {clock.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
