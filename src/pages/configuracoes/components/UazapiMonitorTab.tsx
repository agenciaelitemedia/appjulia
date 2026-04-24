import { useMemo, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Gauge, Users, Cpu, AlertOctagon, Clock, CheckCircle2, XCircle, TrendingUp, Zap, Timer, ArrowUpRight, ArrowDownRight, Minus, Percent } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDispatcherHealth,
  useUazapiHistoryPending,
  useUazapiPendingByClient,
  useUazapiRecentErrors,
  useUazapiWorkerStats,
  useUazapiThroughput,
  useUazapiCompletionTime,
} from '../hooks/useUazapiHistoryRuns';

const MAX_WORKERS = 10;
const TREND_MAX_POINTS = 60; // ~5 min @ 5s

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

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
  const { data: completion } = useUazapiCompletionTime(60);

  const totalPending = pending?.pending ?? 0;
  const itemsPerMin = dispatcher?.items_per_min ?? 0;
  const etaMin = itemsPerMin > 0 && totalPending > 0 ? Math.max(1, Math.ceil(totalPending / itemsPerMin)) : null;

  // ============================================
  // Tendência do backlog (snapshot em memória)
  // ============================================
  const [backlogTrend, setBacklogTrend] = useState<Array<{ ts: number; value: number }>>([]);
  const lastSnapRef = useRef<number>(0);
  useEffect(() => {
    if (pending === undefined) return;
    const now = Date.now();
    if (now - lastSnapRef.current < 4000) return;
    lastSnapRef.current = now;
    setBacklogTrend((prev) => {
      const next = [...prev, { ts: now, value: totalPending }];
      return next.length > TREND_MAX_POINTS ? next.slice(-TREND_MAX_POINTS) : next;
    });
  }, [pending, totalPending]);

  const backlogDelta = useMemo(() => {
    if (backlogTrend.length < 2) return { delta: 0, direction: 'flat' as const, ratePerMin: 0 };
    const first = backlogTrend[0];
    const last = backlogTrend[backlogTrend.length - 1];
    const delta = last.value - first.value;
    const minutes = Math.max(0.5, (last.ts - first.ts) / 60000);
    const ratePerMin = Math.round(delta / minutes);
    const direction = delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat';
    return { delta, direction, ratePerMin };
  }, [backlogTrend]);

  const trendChart = useMemo(() => {
    if (backlogTrend.length === 0) return { points: [] as Array<{ x: number; y: number }>, max: 0, min: 0 };
    const values = backlogTrend.map((p) => p.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    return {
      points: backlogTrend.map((p, i) => ({ x: (i / Math.max(1, backlogTrend.length - 1)) * 100, y: p.value })),
      max,
      min,
    };
  }, [backlogTrend]);

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

  // Top workers por throughput (last hour)
  const topWorkers = useMemo(() => {
    return [...workerStats]
      .sort((a, b) => b.done_last_hour - a.done_last_hour)
      .slice(0, 5)
      .filter((w) => w.done_last_hour > 0);
  }, [workerStats]);

  const totalDoneLastHour = useMemo(
    () => workerStats.reduce((s, w) => s + w.done_last_hour, 0),
    [workerStats],
  );

  const trendDirIcon =
    backlogDelta.direction === 'up' ? ArrowUpRight : backlogDelta.direction === 'down' ? ArrowDownRight : Minus;
  const TrendIcon = trendDirIcon;
  const trendColorClass =
    backlogDelta.direction === 'up'
      ? 'text-red-600'
      : backlogDelta.direction === 'down'
        ? 'text-green-600'
        : 'text-muted-foreground';

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

      {/* ============================================
          MÉTRICAS EM TEMPO REAL (novo painel)
          ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tendência do backlog */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Tendência do backlog
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">
                {backlogTrend.length > 0
                  ? `~${Math.round(((backlogTrend[backlogTrend.length - 1]?.ts ?? 0) - (backlogTrend[0]?.ts ?? 0)) / 60000)}min`
                  : '—'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-5 w-5 ${trendColorClass}`} />
              <div className="flex flex-col">
                <span className={`text-lg font-bold leading-tight ${trendColorClass}`}>
                  {backlogDelta.delta > 0 ? '+' : ''}
                  {backlogDelta.delta.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {backlogDelta.ratePerMin > 0 ? '+' : ''}
                  {backlogDelta.ratePerMin}/min
                </span>
              </div>
              <div className="ml-auto flex-1 h-10 max-w-[120px]">
                {trendChart.points.length > 1 ? (
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={trendColorClass}
                      points={trendChart.points
                        .map((p) => {
                          const range = trendChart.max - trendChart.min || 1;
                          const y = 40 - ((p.y - trendChart.min) / range) * 36 - 2;
                          return `${p.x},${y}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                    coletando…
                  </div>
                )}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {backlogDelta.direction === 'up'
                ? 'fila crescendo — workers não acompanham entrada'
                : backlogDelta.direction === 'down'
                  ? 'fila esvaziando — pipeline saudável'
                  : 'estável'}
            </div>
          </CardContent>
        </Card>

        {/* Tempo médio de conclusão */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              Tempo de conclusão
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">última 1h</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {!completion || completion.sample_size === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                Sem amostras suficientes na última hora.
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">{fmtDuration(completion.avg_seconds)}</span>
                  <span className="text-[10px] text-muted-foreground">média</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between border-l-2 border-blue-500/40 pl-2">
                    <span className="text-muted-foreground">p50</span>
                    <span className="font-mono tabular-nums text-foreground">{fmtDuration(completion.p50_seconds)}</span>
                  </div>
                  <div className="flex justify-between border-l-2 border-amber-500/40 pl-2">
                    <span className="text-muted-foreground">p95</span>
                    <span className="font-mono tabular-nums text-foreground">{fmtDuration(completion.p95_seconds)}</span>
                  </div>
                  <div className="flex justify-between border-l-2 border-green-500/40 pl-2">
                    <span className="text-muted-foreground">min</span>
                    <span className="font-mono tabular-nums text-foreground">{fmtDuration(completion.min_seconds)}</span>
                  </div>
                  <div className="flex justify-between border-l-2 border-red-500/40 pl-2">
                    <span className="text-muted-foreground">max</span>
                    <span className="font-mono tabular-nums text-foreground">{fmtDuration(completion.max_seconds)}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground pt-0.5">
                  amostras: {completion.sample_size.toLocaleString('pt-BR')}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Taxa de sucesso + throughput por worker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              Taxa de sucesso
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">última 1h</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  (completion?.success_rate_pct ?? 100) >= 99
                    ? 'text-green-600'
                    : (completion?.success_rate_pct ?? 100) >= 95
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}
              >
                {(completion?.success_rate_pct ?? 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                {totalDoneLastHour.toLocaleString('pt-BR')} concluídos
              </span>
            </div>
            <Progress
              value={completion?.success_rate_pct ?? 100}
              className="h-1.5"
            />
            <div className="text-[10px] text-muted-foreground">
              throughput médio:{' '}
              <span className="font-mono text-foreground">
                {Math.round(totalDoneLastHour / 60)} items/min
              </span>
              {totalActiveWorkers > 0 && (
                <>
                  {' · '}
                  <span className="font-mono text-foreground">
                    {Math.round(totalDoneLastHour / 60 / Math.max(1, totalActiveWorkers))}/min/worker
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top workers por throughput */}
      {topWorkers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Top workers por throughput (última 1h)
              <Badge variant="outline" className="ml-auto text-[10px]">
                {totalDoneLastHour.toLocaleString('pt-BR')} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topWorkers.map((w) => {
              const pct = totalDoneLastHour > 0 ? (w.done_last_hour / totalDoneLastHour) * 100 : 0;
              const errRate = w.done_last_hour + w.errors_last_hour > 0
                ? (w.errors_last_hour / (w.done_last_hour + w.errors_last_hour)) * 100
                : 0;
              return (
                <div key={w.worker_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                        #{w.worker_id}
                      </Badge>
                      <span className="text-foreground font-medium tabular-nums">
                        {w.done_last_hour.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-muted-foreground">
                        ({Math.round(w.done_last_hour / 60)}/min)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      {errRate > 0 && (
                        <span className="text-red-600 font-mono">
                          {errRate.toFixed(1)}% erros
                        </span>
                      )}
                      <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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