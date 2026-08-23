import { Database, Server, Timer, Layers, AlertTriangle, Zap } from 'lucide-react';
import { Badge, cn } from '../extend/ui';
import type { JuliaChatTimings } from '../api/types';

interface Props {
  timings: JuliaChatTimings | null;
  requests: number;
  rowsLoaded: number;
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur-sm">
      <Icon className={cn('h-4 w-4 text-muted-foreground', tone)} />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

export function JuliaChatPerfPanel({ timings, requests, rowsLoaded }: Props) {
  const hits = timings?.cache_hits ?? 0;
  const misses = timings?.cache_misses ?? 0;
  const refreshed = timings?.cache_refreshed ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Metric icon={Timer} label="Tempo total" value={timings ? `${timings.total_ms} ms` : '—'} />
      <Metric icon={Database} label="BANCO (1 SQL)" value={timings ? `${timings.supabase_ms} ms` : '—'} />
      <Metric icon={Zap} label="Cache legado" value={timings ? `${timings.cache_ms ?? 0} ms · ${hits} hits / ${misses} miss` : '—'} />
      <Metric icon={Server} label="Banco legado" value={timings ? `${timings.external_ms} ms · ${refreshed} chaves` : '—'} />
      <Metric icon={Layers} label="SQL por página" value={timings ? String(timings.sql_count) : '—'} />
      <Metric icon={Layers} label="Requests HTTP" value={String(requests)} />
      <Badge variant="outline" className="h-8 px-3 text-[11px]">{rowsLoaded} cards carregados</Badge>
      {timings?.external_stale && !timings?.external_error && (
        <Badge variant="secondary" className="h-8 gap-1 bg-sky-500/15 px-3 text-[11px] text-sky-600 dark:text-sky-400">
          <Zap className="h-3.5 w-3.5" /> Badges da Júlia servidas do cache
        </Badge>
      )}
      {timings?.external_error && (
        <Badge variant="secondary" className="h-8 gap-1 bg-amber-500/15 px-3 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Banco legado indisponível — usando o último cache
        </Badge>
      )}
    </div>
  );
}
