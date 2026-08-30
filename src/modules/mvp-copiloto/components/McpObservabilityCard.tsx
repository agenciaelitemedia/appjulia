/**
 * Observabilidade do conector MCP: latência, taxa de erro e volume por tool,
 * a partir dos logs estruturados gravados no dispatcher (cop_tool_calls).
 */
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Clock, Copy, Gauge, PenLine, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  useMcpRecentCalls,
  useMcpStats,
  type McpToolStat,
  type McpWindow,
} from '../hooks/useMcpTelemetry';

type SortKey = 'calls' | 'error_rate' | 'p95_ms';

const fmtTime = (iso: string | null, withDate = false) =>
  !iso
    ? '—'
    : new Date(iso).toLocaleString('pt-BR', {
        ...(withDate ? { dateStyle: 'short' as const } : {}),
        timeStyle: 'short' as const,
        timeZone: 'America/Sao_Paulo',
      });

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: 'danger' | 'warn';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p
          className={`mt-1 text-2xl font-semibold ${
            tone === 'danger' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : ''
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function McpObservabilityCard() {
  const [window, setWindow] = useState<McpWindow>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('calls');

  const { data: stats, isLoading, refetch, isFetching } = useMcpStats(window, autoRefresh);
  const { data: recent } = useMcpRecentCalls(autoRefresh, 50);

  const totals = stats?.totals;
  const daily = window === '7d' || window === '30d';

  const chartData = useMemo(
    () =>
      (stats?.timeline || []).map((p) => ({
        label: new Date(p.bucket).toLocaleString('pt-BR', {
          ...(daily ? { day: '2-digit' as const, month: '2-digit' as const } : { hour: '2-digit' as const, minute: '2-digit' as const }),
          timeZone: 'America/Sao_Paulo',
        }),
        ok: Math.max((p.calls || 0) - (p.errors || 0), 0),
        erros: p.errors || 0,
      })),
    [stats?.timeline, daily],
  );

  const tools: McpToolStat[] = useMemo(() => {
    const list = [...(stats?.by_tool || [])];
    return list.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));
  }, [stats?.by_tool, sortKey]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('request_id copiado');
  };

  const errorTone = (totals?.error_rate ?? 0) >= 10 ? 'danger' : (totals?.error_rate ?? 0) > 0 ? 'warn' : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Observabilidade do conector MCP
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={window} onValueChange={(v) => setWindow(v as McpWindow)}>
              <TabsList className="h-8">
                <TabsTrigger value="1h" className="text-xs px-2">1h</TabsTrigger>
                <TabsTrigger value="24h" className="text-xs px-2">24h</TabsTrigger>
                <TabsTrigger value="7d" className="text-xs px-2">7d</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs px-2">30d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant={autoRefresh ? 'secondary' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              Auto {autoRefresh ? 'on' : 'off'}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Activity} label="Chamadas na janela" value={String(totals?.calls ?? 0)} hint={`${totals?.errors ?? 0} com erro`} />
            <Metric icon={AlertTriangle} label="Taxa de erro" value={`${totals?.error_rate ?? 0}%`} tone={errorTone} hint={`${totals?.incomplete_coverage ?? 0} com cobertura incompleta`} />
            <Metric icon={Clock} label="Latência p50 / p95" value={`${totals?.p50_ms ?? 0} / ${totals?.p95_ms ?? 0} ms`} hint={`máx ${totals?.max_ms ?? 0} ms`} />
            <Metric icon={PenLine} label="Chamadas de escrita" value={String(totals?.writes ?? 0)} hint="dry-run e aplicadas" />
          </div>

          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                {isLoading ? 'Carregando telemetria…' : 'Nenhuma chamada registrada nesta janela.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ok" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="erros" stackId="a" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {(stats?.by_error?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats!.by_error.map((e) => (
                <Badge key={e.error_code} variant="outline" className="text-xs">
                  {e.error_code}: {e.calls}
                  {e.retryable && <span className="ml-1 text-muted-foreground">(retentável)</span>}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Por ferramenta</CardTitle>
            <div className="flex gap-1">
              {(['calls', 'error_rate', 'p95_ms'] as SortKey[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={sortKey === k ? 'secondary' : 'ghost'}
                  className="h-7 text-xs"
                  onClick={() => setSortKey(k)}
                >
                  {k === 'calls' ? 'Volume' : k === 'error_rate' ? '% erro' : 'p95'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tool</TableHead>
                    <TableHead className="text-xs text-right">Chamadas</TableHead>
                    <TableHead className="text-xs text-right">% erro</TableHead>
                    <TableHead className="text-xs text-right">p50</TableHead>
                    <TableHead className="text-xs text-right">p95</TableHead>
                    <TableHead className="text-xs text-right">Última</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                        Sem dados na janela.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tools.map((t) => (
                      <TableRow key={t.tool_name}>
                        <TableCell className="text-xs font-mono">
                          {t.tool_name}
                          {t.mode === 'write' && (
                            <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">escrita</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">{t.calls}</TableCell>
                        <TableCell className={`text-xs text-right ${Number(t.error_rate) > 0 ? 'text-destructive' : ''}`}>
                          {t.error_rate}%
                        </TableCell>
                        <TableCell className="text-xs text-right">{t.p50_ms}ms</TableCell>
                        <TableCell className="text-xs text-right">{t.p95_ms}ms</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{fmtTime(t.last_call_at, true)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimas chamadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-auto divide-y">
              {(recent || []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma chamada registrada ainda.</p>
              ) : (
                recent!.map((c) => (
                  <div key={c.request_id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono truncate">{c.tool_name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={c.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {c.status === 'error' ? c.error_code || 'ERRO' : 'ok'}
                        </Badge>
                        <span className="text-muted-foreground">{c.latency_ms}ms</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span>
                        {fmtTime(c.created_at, true)}
                        {c.result_count !== null && ` · ${c.result_count} itens`}
                        {c.coverage_complete === false && ' · cobertura incompleta'}
                        {c.dry_run === true && ' · dry-run'}
                        {c.dependency && ` · ${c.dependency}`}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => copy(c.request_id)}
                      >
                        <Copy className="h-3 w-3" />
                        <span className="font-mono">{c.request_id.slice(0, 8)}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
