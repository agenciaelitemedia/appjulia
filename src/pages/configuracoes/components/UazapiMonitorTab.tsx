import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Gauge, Users, Cpu, AlertOctagon, Clock, CheckCircle2, XCircle, TrendingUp, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDispatcherHealth,
  useUazapiHistoryPending,
  useUazapiPendingByClient,
  useUazapiRecentErrors,
  useUazapiWorkerStats,
  useUazapiThroughput,
} from '../hooks/useUazapiHistoryRuns';

const MAX_WORKERS = 10;

function fmtTs(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return format(new Date(v), 'dd/MM HH:mm:ss', { locale: ptBR });
  } catch {
    return '—';
  }
}

function fmtRelative(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return formatDistanceToNow(new Date(v), { locale: ptBR, addSuffix: true });
  } catch {
    return '—';
  }
}

export function UazapiMonitorTab() {
  const { data: dispatcher } = useDispatcherHealth();
  const { data: pending } = useUazapiHistoryPending();
  const { data: byClient = [] } = useUazapiPendingByClient();
  const { data: workerStats = [] } = useUazapiWorkerStats();
  const { data: errors = [] } = useUazapiRecentErrors(50);
  const { data: throughput = [] } = useUazapiThroughput(30);

  const totalPending = pending?.pending ?? 0;
  const itemsPerMin = dispatcher?.items_per_min ?? 0;
  const etaMin = itemsPerMin > 0 && totalPending > 0 ? Math.max(1, Math.ceil(totalPending / itemsPerMin)) : null;

  const dispatcherTone = !dispatcher
    ? 'muted'
    : dispatcher.is_offline
      ? 'red'
      : dispatcher.is_warning
        ? 'amber'
        : 'green';

  const toneClass: Record<string, string> = {
    muted: 'border-muted bg-muted/30 text-muted-foreground',
    red: 'border-red-500/30 bg-red-500/10 text-red-700',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    green: 'border-green-500/30 bg-green-500/10 text-green-700',
  };

  // Throughput chart (sparkline-like) — últimos 30min
  const chart = useMemo(() => {
    if (throughput.length === 0) return { points: [], maxY: 0, totalOk: 0, totalErr: 0 };
    const max = Math.max(...throughput.map((p) => p.ok_count + p.error_count), 1);
    const totalOk = throughput.reduce((s, p) => s + p.ok_count, 0);
    const totalErr = throughput.reduce((s, p) => s + p.error_count, 0);
    return { points: throughput, maxY: max, totalOk, totalErr };
  }, [throughput]);

  // Workers — preenche slots vazios para visualizar pool inteiro
  const workersDisplay = useMemo(() => {
    const map = new Map(workerStats.map((w) => [w.worker_id, w]));
    return Array.from({ length: MAX_WORKERS }, (_, i) =>
      map.get(i) ?? { worker_id: i, active_locks: 0, errors_last_hour: 0, done_last_hour: 0, last_activity: null },
    );
  }, [workerStats]);

  const totalActiveWorkers = dispatcher?.workers_active ?? workersDisplay.filter((w) => w.active_locks > 0).length;
  const utilizationPct = Math.round((totalActiveWorkers / MAX_WORKERS) * 100);

  const maxClientPending = useMemo(
    () => Math.max(1, ...byClient.map((c) => c.pending_count)),
    [byClient],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Monitoramento da fila de histórico</h2>
        <p className="text-sm text-muted-foreground">
          Painel detalhado em tempo real da pipeline push-based: dispatcher, workers, throughput e erros recentes.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={toneClass[dispatcherTone]}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2">
              <Activity className={`h-3.5 w-3.5 ${dispatcher?.is_healthy && totalActiveWorkers > 0 ? 'animate-pulse' : ''}`} />
              Dispatcher
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold">
              {!dispatcher ? 'Aguardando' : dispatcher.is_offline ? 'OFFLINE' : dispatcher.is_warning ? 'Atrasado' : 'Saudável'}
            </div>
            <div className="text-xs opacity-80">
              Heartbeat: {dispatcher ? `${dispatcher.seconds_since_heartbeat}s atrás` : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              Workers ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xl font-bold text-foreground">
              {totalActiveWorkers}<span className="text-sm font-normal text-muted-foreground"> / {MAX_WORKERS}</span>
            </div>
            <Progress value={utilizationPct} className="h-1.5" />
            <div className="text-xs text-muted-foreground">{utilizationPct}% utilização do pool</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Vazão atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold text-foreground">{itemsPerMin.toLocaleString('pt-BR')}</div>
            <div className="text-xs text-muted-foreground">items/min · pico ~5.000</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Backlog
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-bold text-foreground">{totalPending.toLocaleString('pt-BR')}</div>
            <div className="text-xs text-muted-foreground">
              {etaMin !== null ? `ETA ~${etaMin} min` : totalPending === 0 ? 'fila vazia' : 'aguardando worker'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Throughput chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Throughput (últimos 30 min)
              <Badge variant="outline" className="ml-auto gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" /> {chart.totalOk.toLocaleString('pt-BR')}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3 text-red-600" /> {chart.totalErr.toLocaleString('pt-BR')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chart.points.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Sem atividade nos últimos 30 minutos
              </div>
            ) : (
              <div className="h-32 flex items-end gap-0.5">
                {chart.points.map((p) => {
                  const okPct = (p.ok_count / chart.maxY) * 100;
                  const errPct = (p.error_count / chart.maxY) * 100;
                  return (
                    <div
                      key={p.bucket}
                      className="flex-1 flex flex-col-reverse min-w-[3px]"
                      title={`${format(new Date(p.bucket), 'HH:mm')} · ${p.ok_count} ok · ${p.error_count} erros`}
                    >
                      <div
                        className="bg-green-500/70 hover:bg-green-500 transition-colors rounded-t-sm"
                        style={{ height: `${okPct}%`, minHeight: p.ok_count > 0 ? '2px' : '0' }}
                      />
                      {p.error_count > 0 && (
                        <div
                          className="bg-red-500/80 hover:bg-red-500 transition-colors"
                          style={{ height: `${errPct}%`, minHeight: '2px' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending por cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Pendentes por cliente
              <Badge variant="outline" className="ml-auto">{byClient.length} cliente(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Nenhum cliente com pendências
              </div>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-3">
                  {byClient
                    .slice()
                    .sort((a, b) => b.pending_count - a.pending_count)
                    .map((c) => {
                      const pct = (c.pending_count / maxClientPending) * 100;
                      return (
                        <div key={c.client_id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground truncate max-w-[60%]" title={c.client_name || c.client_id}>
                              {c.client_name || c.client_id}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {c.pending_count.toLocaleString('pt-BR')}
                              {c.oldest_pending_at && (
                                <span className="ml-2 opacity-70">· {fmtRelative(c.oldest_pending_at)}</span>
                              )}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pool de workers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Pool de workers (última 1h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {workersDisplay.map((w) => {
              const isActive = w.active_locks > 0;
              const hasErrors = w.errors_last_hour > 0;
              return (
                <div
                  key={w.worker_id}
                  className={`border rounded-lg p-2.5 ${
                    isActive
                      ? 'bg-blue-500/5 border-blue-500/30'
                      : hasErrors
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-semibold text-foreground">#{w.worker_id}</span>
                    {isActive ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[9px] px-1 py-0 gap-1">
                        <Activity className="h-2.5 w-2.5 animate-pulse" /> ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">idle</Badge>
                    )}
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between text-green-600">
                      <span>OK</span>
                      <span className="font-mono font-semibold tabular-nums">{w.done_last_hour.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className={`flex justify-between ${hasErrors ? 'text-red-600' : 'text-muted-foreground'}`}>
                      <span>Erros</span>
                      <span className="font-mono font-semibold tabular-nums">{w.errors_last_hour}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Locks</span>
                      <span className="font-mono tabular-nums">{w.active_locks}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1 truncate" title={w.last_activity ?? '—'}>
                    {w.last_activity ? fmtRelative(w.last_activity) : 'sem atividade'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Erros recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-600" />
            Erros recentes
            <Badge variant="outline" className="ml-auto">{errors.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {errors.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
              Nenhum erro registrado nos itens
            </div>
          ) : (
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Quando</TableHead>
                    <TableHead className="w-[70px]">Worker</TableHead>
                    <TableHead>Conversa</TableHead>
                    <TableHead className="w-[60px] text-center">Tent.</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTs(e.processed_at)}</TableCell>
                      <TableCell>
                        {e.worker_id !== null ? (
                          <Badge variant="outline" className="font-mono text-[10px]">#{e.worker_id}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] truncate max-w-[180px]" title={e.remote_jid}>
                        {e.phone || e.remote_jid}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{e.attempts}</TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[400px] truncate" title={e.error ?? ''}>
                        {e.error || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}