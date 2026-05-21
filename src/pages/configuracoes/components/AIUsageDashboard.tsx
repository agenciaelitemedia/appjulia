import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Activity, Coins, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

type Row = {
  id: string;
  created_at: string;
  client_id: string | null;
  feature: string;
  provider: string;
  endpoint: string;
  model: string;
  status: string;
  duration_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  error_reason: string | null;
  context: Record<string, any> | null;
};

const FEATURE_LABELS: Record<string, string> = {
  chat_transcription: 'Transcrição de áudio',
  chat_assist: 'Assistente do chat',
  chat_resume: 'Resumo de conversa',
  copilot_crm: 'Copiloto CRM',
  copilot_chat: 'Copiloto chat',
  chat_autoreply: 'Auto-resposta',
  support_transcription: 'Transcrição (suporte)',
  script_generation: 'Geração de prompt',
};

const PRESETS: Array<{ label: string; days: number }> = [
  { label: 'Últimas 24h', days: 1 },
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
];

export function AIUsageDashboard() {
  const [days, setDays] = useState<number>(7);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [featureFilter, setFeatureFilter] = useState<string>('all');

  const fromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai_usage_logs', days, clientFilter, featureFilter],
    queryFn: async () => {
      let q = supabase
        .from('ai_usage_logs')
        .select('*')
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (clientFilter !== 'all') q = q.eq('client_id', clientFilter);
      if (featureFilter !== 'all') q = q.eq('feature', featureFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 30_000,
  });

  const { data: distinctClients } = useQuery({
    queryKey: ['ai_usage_logs_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('client_id')
        .not('client_id', 'is', null)
        .limit(2000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.client_id && set.add(String(r.client_id)));
      return Array.from(set).sort();
    },
    staleTime: 60_000,
  });

  const rows = data ?? [];

  const kpis = useMemo(() => {
    const total = rows.length;
    const ok = rows.filter((r) => r.status === 'ok' || r.status === 'fallback').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const tokens = rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
    const promptTokens = rows.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
    const completionTokens = rows.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);
    const avgLatency = total
      ? Math.round(rows.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / total)
      : 0;
    const successRate = total ? Math.round((ok / total) * 100) : 0;
    return { total, ok, failed, tokens, promptTokens, completionTokens, avgLatency, successRate };
  }, [rows]);

  // Agregação por agente/feature
  const byFeature = useMemo(() => {
    const map = new Map<string, {
      feature: string; calls: number; promptTokens: number; completionTokens: number;
      totalTokens: number; latencySum: number; failed: number;
      modelCounts: Map<string, number>; providers: Set<string>;
    }>();
    for (const r of rows) {
      let bucket = map.get(r.feature);
      if (!bucket) {
        bucket = {
          feature: r.feature, calls: 0, promptTokens: 0, completionTokens: 0,
          totalTokens: 0, latencySum: 0, failed: 0,
          modelCounts: new Map(), providers: new Set(),
        };
        map.set(r.feature, bucket);
      }
      bucket.calls += 1;
      bucket.promptTokens += r.prompt_tokens ?? 0;
      bucket.completionTokens += r.completion_tokens ?? 0;
      bucket.totalTokens += r.total_tokens ?? 0;
      bucket.latencySum += r.duration_ms ?? 0;
      if (r.status === 'failed') bucket.failed += 1;
      bucket.modelCounts.set(r.model, (bucket.modelCounts.get(r.model) ?? 0) + 1);
      bucket.providers.add(r.provider);
    }
    return Array.from(map.values())
      .map((b) => ({
        feature: b.feature,
        calls: b.calls,
        promptTokens: b.promptTokens,
        completionTokens: b.completionTokens,
        totalTokens: b.totalTokens,
        avgLatency: b.calls ? Math.round(b.latencySum / b.calls) : 0,
        failRate: b.calls ? Math.round((b.failed / b.calls) * 100) : 0,
        topModel: Array.from(b.modelCounts.entries()).sort((a, z) => z[1] - a[1])[0]?.[0] ?? '-',
        providers: Array.from(b.providers).join(', '),
      }))
      .sort((a, z) => z.calls - a.calls);
  }, [rows]);

  // Série temporal — chamadas por dia agrupadas por feature
  const series = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    const features = new Set<string>();
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      features.add(r.feature);
      const bucket = byDay.get(day) ?? {};
      bucket[r.feature] = (bucket[r.feature] ?? 0) + 1;
      byDay.set(day, bucket);
    }
    const allDays = Array.from(byDay.keys()).sort();
    const data = allDays.map((day) => ({ day, ...byDay.get(day)! }));
    return { data, features: Array.from(features) };
  }, [rows]);

  const recent = useMemo(() => rows.slice(0, 50), [rows]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {(distinctClients ?? []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Agente</Label>
            <Select value={featureFilter} onValueChange={setFeatureFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {Object.entries(FEATURE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="ml-auto">
            <RefreshCcw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Chamadas" value={kpis.total.toLocaleString('pt-BR')} loading={isLoading} />
        <KpiCard icon={<Coins className="h-4 w-4" />} label="Tokens totais" value={kpis.tokens.toLocaleString('pt-BR')} loading={isLoading} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Latência média" value={`${kpis.avgLatency} ms`} loading={isLoading} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Taxa de sucesso" value={`${kpis.successRate}%`} loading={isLoading} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Falhas" value={kpis.failed.toLocaleString('pt-BR')} loading={isLoading} />
      </div>

      {/* Tabela por agente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso por agente</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : byFeature.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Prompt</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                  <TableHead className="text-right">Total tokens</TableHead>
                  <TableHead className="text-right">Latência</TableHead>
                  <TableHead className="text-right">% falha</TableHead>
                  <TableHead>Modelo principal</TableHead>
                  <TableHead>Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byFeature.map((r) => (
                  <TableRow key={r.feature}>
                    <TableCell className="font-medium">{FEATURE_LABELS[r.feature] ?? r.feature}</TableCell>
                    <TableCell className="text-right">{r.calls.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{r.promptTokens.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{r.completionTokens.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{r.totalTokens.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{r.avgLatency} ms</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.failRate > 10 ? 'destructive' : 'secondary'}>{r.failRate}%</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.topModel}</TableCell>
                    <TableCell>{r.providers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chamadas por dia</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 280 }}>
          {series.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                {series.features.map((f, idx) => (
                  <Line
                    key={f}
                    type="monotone"
                    dataKey={f}
                    name={FEATURE_LABELS[f] ?? f}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Logs recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs recentes (últimos 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem logs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Latência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-xs">{r.client_id ?? '-'}</TableCell>
                    <TableCell className="text-xs">{FEATURE_LABELS[r.feature] ?? r.feature}</TableCell>
                    <TableCell className="text-xs font-mono">{r.model}</TableCell>
                    <TableCell className="text-xs">{r.provider}</TableCell>
                    <TableCell className="text-right text-xs">{r.total_tokens ?? '-'}</TableCell>
                    <TableCell className="text-right text-xs">{r.duration_ms ? `${r.duration_ms} ms` : '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} reason={r.error_reason} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const LINE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function KpiCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon} <span>{label}</span>
        </div>
        {loading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-semibold">{value}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  if (status === 'ok') return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OK</Badge>;
  if (status === 'fallback') return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Fallback</Badge>;
  if (status === 'failed') return <Badge variant="destructive" title={reason ?? ''}>Falha</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}