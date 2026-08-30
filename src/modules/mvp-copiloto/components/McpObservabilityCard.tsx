/**
 * Observabilidade do conector MCP: alertas por tool, percentis de latência,
 * volume, filtros, exportação CSV/JSON e drill-down por request_id.
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
import {
  Activity,
  AlertTriangle,
  Clock,
  Copy,
  Download,
  Gauge,
  PenLine,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useIsOwner } from '@/lib/auth/isOwner';
import {
  evaluateAlerts,
  resolveRange,
  useMcpRecentCalls,
  useMcpStats,
  useMcpThresholds,
  type AlertState,
  type McpFilters,
  type McpToolStat,
  type McpWindow,
} from '../hooks/useMcpTelemetry';
import { exportCallLogs, exportToolMetrics, slugRange } from '../lib/mcpExport';
import { McpThresholdsDialog } from './McpThresholdsDialog';
import { McpCallDetailSheet } from './McpCallDetailSheet';

type SortKey = 'calls' | 'error_rate' | 'p50_ms' | 'p95_ms' | 'p99_ms';

const ALL = '__all__';

const stateBadge: Record<AlertState, { label: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  ok: { label: 'OK', variant: 'secondary' },
  warning: { label: 'Atenção', variant: 'outline' },
  critical: { label: 'Crítico', variant: 'destructive' },
};

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
  const canEdit = useIsOwner();

  const [filters, setFilters] = useState<McpFilters>({ window: '24h' });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('calls');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: stats, isLoading, refetch, isFetching } = useMcpStats(filters, autoRefresh);
  const { data: recent } = useMcpRecentCalls(filters, autoRefresh, 200);
  const { data: thresholds } = useMcpThresholds();

  const totals = stats?.totals;
  const { from, to, bucket } = resolveRange(filters);

  const alerts = useMemo(() => evaluateAlerts(stats?.by_tool || [], thresholds || []), [stats?.by_tool, thresholds]);
  const firing = useMemo(
    () => [...alerts.values()].filter((a) => a.state !== 'ok').sort((a) => (a.state === 'critical' ? -1 : 1)),
    [alerts],
  );

  const chartData = useMemo(
    () =>
      (stats?.timeline || []).map((p) => ({
        label: new Date(p.bucket).toLocaleString('pt-BR', {
          ...(bucket === 'day'
            ? { day: '2-digit' as const, month: '2-digit' as const }
            : { hour: '2-digit' as const, minute: '2-digit' as const }),
          timeZone: 'America/Sao_Paulo',
        }),
        ok: Math.max((p.calls || 0) - (p.errors || 0), 0),
        erros: p.errors || 0,
      })),
    [stats?.timeline, bucket],
  );

  const tools: McpToolStat[] = useMemo(() => {
    const list = [...(stats?.by_tool || [])];
    return list.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));
  }, [stats?.by_tool, sortKey]);

  const domains = useMemo(
    () => [...new Set((stats?.by_tool || []).map((t) => t.domain).filter(Boolean))] as string[],
    [stats?.by_tool],
  );

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('request_id copiado');
  };

  const patch = (next: Partial<McpFilters>) => setFilters((f) => ({ ...f, ...next }));

  const exportName = slugRange(from, to, filters.tool || filters.domain || undefined);

  const openSearch = () => {
    const id = search.trim();
    if (!id) return;
    setRequestId(id);
  };

  const errorTone = (totals?.error_rate ?? 0) >= 10 ? 'danger' : (totals?.error_rate ?? 0) > 0 ? 'warn' : undefined;

  return (
    <div className="space-y-4">
      {firing.length > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {firing.length} ferramenta(s) fora dos limites configurados
            </div>
            <ul className="space-y-1">
              {firing.map((a) => (
                <li key={a.tool_name} className="text-xs flex items-start gap-2">
                  <Badge variant={stateBadge[a.state].variant} className="text-[10px] shrink-0">
                    {stateBadge[a.state].label}
                  </Badge>
                  <span className="font-mono">{a.tool_name}</span>
                  <span className="text-muted-foreground">{a.reasons.join(' · ')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Observabilidade do conector MCP
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={filters.window} onValueChange={(v) => patch({ window: v as McpWindow })}>
              <TabsList className="h-8">
                <TabsTrigger value="1h" className="text-xs px-2">1h</TabsTrigger>
                <TabsTrigger value="24h" className="text-xs px-2">24h</TabsTrigger>
                <TabsTrigger value="7d" className="text-xs px-2">7d</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs px-2">30d</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs px-2">Período</TabsTrigger>
              </TabsList>
            </Tabs>
            <McpThresholdsDialog toolNames={(stats?.by_tool || []).map((t) => t.tool_name)} canEdit={canEdit} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Métricas por ferramenta</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportToolMetrics(tools, 'csv', exportName)}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToolMetrics(tools, 'json', exportName)}>JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Logs estruturados</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportCallLogs(recent || [], 'csv', exportName)}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCallLogs(recent || [], 'json', exportName)}>JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="flex flex-wrap items-end gap-2">
            {filters.window === 'custom' && (
              <>
                <Input
                  type="date"
                  className="h-8 w-auto text-xs"
                  value={filters.fromDate || ''}
                  onChange={(e) => patch({ fromDate: e.target.value })}
                />
                <Input
                  type="date"
                  className="h-8 w-auto text-xs"
                  value={filters.toDate || ''}
                  onChange={(e) => patch({ toDate: e.target.value })}
                />
              </>
            )}
            <Select
              value={filters.tool || ALL}
              onValueChange={(v) => patch({ tool: v === ALL ? undefined : v })}
            >
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Ferramenta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as ferramentas</SelectItem>
                {(stats?.by_tool || []).map((t) => (
                  <SelectItem key={t.tool_name} value={t.tool_name}>{t.tool_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.domain || ALL}
              onValueChange={(v) => patch({ domain: v === ALL ? undefined : v })}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Domínio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os domínios</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.mode || ALL} onValueChange={(v) => patch({ mode: v === ALL ? undefined : v })}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Modo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Leitura e escrita</SelectItem>
                <SelectItem value="read">Leitura</SelectItem>
                <SelectItem value="write">Escrita</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status || ALL} onValueChange={(v) => patch({ status: v === ALL ? undefined : v })}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                <SelectItem value="ok">Somente ok</SelectItem>
                <SelectItem value="error">Somente erro</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                placeholder="request_id"
                className="h-8 w-[240px] text-xs font-mono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && openSearch()}
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={openSearch}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Activity} label="Chamadas na janela" value={String(totals?.calls ?? 0)} hint={`${totals?.errors ?? 0} com erro`} />
            <Metric
              icon={AlertTriangle}
              label="Taxa de erro"
              value={`${totals?.error_rate ?? 0}%`}
              tone={errorTone}
              hint={`${totals?.incomplete_coverage ?? 0} com cobertura incompleta`}
            />
            <Metric
              icon={Clock}
              label="p50 / p95 / p99"
              value={`${totals?.p50_ms ?? 0} / ${totals?.p95_ms ?? 0} / ${totals?.p99_ms ?? 0} ms`}
              hint={`máx ${totals?.max_ms ?? 0} ms`}
            />
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
                  <Bar dataKey="ok" stackId="a" fill="hsl(var(--primary))" />
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
                  {e.dependency && <span className="ml-1 text-muted-foreground">· {e.dependency}</span>}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Por ferramenta</CardTitle>
            <div className="flex gap-1">
              {(['calls', 'error_rate', 'p50_ms', 'p95_ms', 'p99_ms'] as SortKey[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={sortKey === k ? 'secondary' : 'ghost'}
                  className="h-7 text-xs px-2"
                  onClick={() => setSortKey(k)}
                >
                  {k === 'calls' ? 'Volume' : k === 'error_rate' ? '% erro' : k.replace('_ms', '')}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tool</TableHead>
                    <TableHead className="text-xs">Alerta</TableHead>
                    <TableHead className="text-xs text-right">Chamadas</TableHead>
                    <TableHead className="text-xs text-right">% erro</TableHead>
                    <TableHead className="text-xs text-right">p50</TableHead>
                    <TableHead className="text-xs text-right">p95</TableHead>
                    <TableHead className="text-xs text-right">p99</TableHead>
                    <TableHead className="text-xs text-right">Última</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                        Sem dados na janela.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tools.map((t) => {
                      const state = alerts.get(t.tool_name)?.state ?? 'ok';
                      const badge = stateBadge[state];
                      return (
                        <TableRow
                          key={t.tool_name}
                          className="cursor-pointer"
                          onClick={() => patch({ tool: t.tool_name })}
                        >
                          <TableCell className="text-xs font-mono">
                            {t.tool_name}
                            {t.mode === 'write' && (
                              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">escrita</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right">{t.calls}</TableCell>
                          <TableCell className={`text-xs text-right ${Number(t.error_rate) > 0 ? 'text-destructive' : ''}`}>
                            {t.error_rate}%
                          </TableCell>
                          <TableCell className="text-xs text-right">{t.p50_ms}ms</TableCell>
                          <TableCell className="text-xs text-right">{t.p95_ms}ms</TableCell>
                          <TableCell className="text-xs text-right">{t.p99_ms}ms</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{fmtTime(t.last_call_at, true)}</TableCell>
                        </TableRow>
                      );
                    })
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
            <div className="max-h-96 overflow-auto divide-y">
              {(recent || []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma chamada registrada ainda.</p>
              ) : (
                recent!.map((c) => (
                  <button
                    key={c.request_id}
                    type="button"
                    className="w-full text-left p-3 text-xs space-y-1 hover:bg-muted/50"
                    onClick={() => setRequestId(c.request_id)}
                  >
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
                      <span
                        role="button"
                        tabIndex={-1}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          copy(c.request_id);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        <span className="font-mono">{c.request_id.slice(0, 8)}</span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <McpCallDetailSheet requestId={requestId} onOpenChange={(open) => !open && setRequestId(null)} />
    </div>
  );
}
