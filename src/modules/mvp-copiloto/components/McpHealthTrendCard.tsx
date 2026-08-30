/**
 * Correlação entre saúde das dependências, latência e erros tipados,
 * com tendência diária dos últimos 30 dias.
 */
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HeartPulse, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { mcpCall } from '../lib/copilotoApi';
import {
  evaluateAlerts,
  useMcpDailyTrend,
  useMcpThresholds,
  type AlertState,
} from '../hooks/useMcpTelemetry';

const TOKEN_KEY = 'copiloto.test.token';

const stateBadge: Record<AlertState, { label: string; variant: 'secondary' | 'destructive' | 'outline' }> = {
  ok: { label: 'OK', variant: 'secondary' },
  warning: { label: 'Atenção', variant: 'outline' },
  critical: { label: 'Crítico', variant: 'destructive' },
};

export function McpHealthTrendCard() {
  const { data: trend, isLoading, refetch, isFetching } = useMcpDailyTrend(true);
  const { data: thresholds } = useMcpThresholds();
  const [health, setHealth] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const alerts = useMemo(
    () => evaluateAlerts(trend?.by_tool || [], thresholds || []),
    [trend?.by_tool, thresholds],
  );

  const chart = useMemo(
    () =>
      (trend?.timeline || []).map((p) => {
        const raw = String(p.bucket || '').replace(/([+-]\d{2})$/, '$1:00');
        const date = new Date(raw);
        return {
          label: Number.isNaN(date.getTime())
            ? String(p.bucket ?? '—')
            : date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                timeZone: 'America/Sao_Paulo',
              }),
          chamadas: p.calls,
          'erro %': Number(p.error_rate) || 0,
          p95: p.p95_ms || 0,
        };
      }),
    [trend?.timeline],
  );


  /** Dependências vistas nas falhas: separa problema nosso de problema do provedor. */
  const dependencies = useMemo(() => {
    const map = new Map<string, { calls: number; codes: Set<string> }>();
    for (const e of trend?.by_error || []) {
      const key = e.dependency || 'interno';
      const entry = map.get(key) || { calls: 0, codes: new Set<string>() };
      entry.calls += e.calls;
      entry.codes.add(e.error_code);
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].calls - a[1].calls);
  }, [trend?.by_error]);

  const runHealth = async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      toast.error('Gere o token de teste na aba "Conexão e ferramentas" para consultar o mcp_health.');
      return;
    }
    setBusy(true);
    try {
      const result = await mcpCall(token, 'tools/call', { name: 'mcp_health', arguments: {} });
      setHealth(result?.content?.[0]?.text ?? JSON.stringify(result, null, 2));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            Saúde, latência e erros — últimos 30 dias
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={runHealth} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
              Consultar mcp_health
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-60">
            {chart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                {isLoading ? 'Carregando tendência…' : 'Sem chamadas nos últimos 30 dias.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <ReTooltip contentStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="chamadas" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="erro %" stroke="hsl(var(--destructive))" dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="p95" stroke="hsl(var(--muted-foreground))" dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Origem das falhas</p>
            {dependencies.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma falha registrada no período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dependencies.map(([dep, info]) => (
                  <Badge
                    key={dep}
                    variant={dep === 'interno' ? 'outline' : 'destructive'}
                    className="text-xs"
                    title={[...info.codes].join(', ')}
                  >
                    {dep === 'interno' ? 'Interno (nosso)' : `Provedor: ${dep}`} · {info.calls}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {health && (
            <pre className="text-[11px] bg-muted rounded-md p-3 overflow-auto max-h-56 whitespace-pre-wrap">{health}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status por ferramenta (30 dias)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tool</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Chamadas</TableHead>
                  <TableHead className="text-xs text-right">% erro</TableHead>
                  <TableHead className="text-xs text-right">p95</TableHead>
                  <TableHead className="text-xs">Erro predominante</TableHead>
                  <TableHead className="text-xs">Dependência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(trend?.by_tool || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      Sem dados no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  (trend?.by_tool || []).map((t) => {
                    const state = alerts.get(t.tool_name)?.state ?? 'ok';
                    const badge = stateBadge[state];
                    return (
                      <TableRow key={t.tool_name}>
                        <TableCell className="text-xs font-mono">{t.tool_name}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">{t.calls}</TableCell>
                        <TableCell className={`text-xs text-right ${Number(t.error_rate) > 0 ? 'text-destructive' : ''}`}>
                          {t.error_rate}%
                        </TableCell>
                        <TableCell className="text-xs text-right">{t.p95_ms}ms</TableCell>
                        <TableCell className="text-xs">{t.top_error || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {t.top_dependency ? (
                            <span className="text-destructive">{t.top_dependency}</span>
                          ) : (
                            <span className="text-muted-foreground">interno</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
