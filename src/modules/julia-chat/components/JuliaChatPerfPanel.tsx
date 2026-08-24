import { Database, Server, Timer, Layers, AlertTriangle, Zap } from 'lucide-react';
import { Badge, cn } from '../extend/ui';
import type { JuliaChatCounters, JuliaChatTimings } from '../api/types';
import type { JuliaTabKey } from '../hooks/useJuliaChatTabs';

interface Props {
  timings: JuliaChatTimings | null;
  requests: number;
  rowsLoaded: number;
  counters?: JuliaChatCounters | null;
  activeTab?: JuliaTabKey;
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-card/60 px-2 py-1.5 backdrop-blur-sm">
      <Icon className={cn('h-3.5 w-3.5 text-muted-foreground', tone)} />
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

export function JuliaChatPerfPanel({ timings, requests, rowsLoaded, counters, activeTab = 'open' }: Props) {
  const hits = timings?.cache_hits ?? 0;
  const misses = timings?.cache_misses ?? 0;
  const refreshed = timings?.cache_refreshed ?? 0;

  const total = counters
    ? activeTab === 'pending'
      ? counters.pending
      : activeTab === 'resolved_closed'
        ? (counters.resolved ?? 0) + (counters.closed ?? 0)
        : counters.open
    : null;

  const label = activeTab === 'pending' ? 'aguardando' : activeTab === 'resolved_closed' ? 'encerrados' : 'em atendimento';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Metric icon={Timer} label="Tempo total" value={timings ? `${timings.total_ms} ms` : '—'} />
      <Metric icon={Database} label="BANCO (1 SQL)" value={timings ? `${timings.supabase_ms} ms` : '—'} />
      <Metric icon={Zap} label="Cache legado" value={timings ? `${timings.cache_ms ?? 0} ms · ${hits} hits / ${misses} miss` : '—'} />
      <Metric icon={Server} label="Banco legado" value={timings ? `${timings.external_ms} ms · ${refreshed} chaves` : '—'} />
      <Metric icon={Layers} label="SQL por página" value={timings ? String(timings.sql_count) : '—'} />
      <Metric icon={Layers} label="Requests HTTP" value={String(requests)} />
      <Badge variant="outline" className="h-7 gap-1 px-2 text-[10px]">
        {rowsLoaded} cards {total !== null ? `de ${total} ${label}` : 'carregados'}
      </Badge>
      {timings?.external_stale && !timings?.external_error && (
        <Badge variant="secondary" className="h-7 gap-1 bg-sky-500/15 px-2 text-[10px] text-sky-600 dark:text-sky-400">
          <Zap className="h-3 w-3" /> Badges da Júlia servidas do cache
        </Badge>
      )}
      {timings?.external_error && (
        <Badge variant="secondary" className="h-7 gap-1 bg-amber-500/15 px-2 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" /> Banco legado indisponível — usando o último cache
        </Badge>
      )}
    </div>
  );
}
