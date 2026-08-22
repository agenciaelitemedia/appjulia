/**
 * Métricas do X-Julia — leitura dos agregados diários (xj_analytics_daily).
 */
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { XJLayout } from '../components/XJLayout';
import { useXJAnalyticsDaily } from '../hooks/useXJAnalytics';

const usd = (v: number) => `US$ ${Number(v ?? 0).toFixed(2)}`;
const int = (v: number) => Number(v ?? 0).toLocaleString('pt-BR');
const dayLabel = (iso: string) => {
  const [, m, d] = String(iso).split('-');
  return `${d}/${m}`;
};

export default function XJMetricsPage() {
  const [range, setRange] = useState('30');
  const { data = [], isLoading } = useXJAnalyticsDaily(Number(range));

  const chart = useMemo(() => data.map((row) => ({ ...row, label: dayLabel(row.day) })), [data]);

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, row) => ({
          sessions_started: acc.sessions_started + row.sessions_started,
          turns: acc.turns + row.turns,
          cost_usd: acc.cost_usd + row.cost_usd,
          qualified: acc.qualified + row.qualified,
          disqualified: acc.disqualified + row.disqualified,
          handoffs: acc.handoffs + row.handoffs,
          contracts_sent: acc.contracts_sent + row.contracts_sent,
          followups_sent: acc.followups_sent + row.followups_sent,
          llm_errors: acc.llm_errors + row.llm_errors,
          circuit_breaks: acc.circuit_breaks + row.circuit_breaks,
          tokens: acc.tokens + row.prompt_tokens + row.completion_tokens,
        }),
        {
          sessions_started: 0,
          turns: 0,
          cost_usd: 0,
          qualified: 0,
          disqualified: 0,
          handoffs: 0,
          contracts_sent: 0,
          followups_sent: 0,
          llm_errors: 0,
          circuit_breaks: 0,
          tokens: 0,
        },
      ),
    [data],
  );

  const qualifiedTotal = totals.qualified + totals.disqualified;
  const cards = [
    { label: 'Atendimentos iniciados', value: int(totals.sessions_started) },
    { label: 'Turnos de conversa', value: int(totals.turns) },
    { label: 'Custo com IA', value: usd(totals.cost_usd) },
    { label: 'Custo por atendimento', value: usd(totals.sessions_started ? totals.cost_usd / totals.sessions_started : 0) },
    {
      label: 'Taxa de qualificação',
      value: qualifiedTotal ? `${Math.round((totals.qualified / qualifiedTotal) * 100)}%` : '—',
    },
    { label: 'Contratos enviados', value: int(totals.contracts_sent) },
    { label: 'Passagens para humano', value: int(totals.handoffs) },
    { label: 'Follow-ups enviados', value: int(totals.followups_sent) },
    { label: 'Tokens consumidos', value: int(totals.tokens) },
    { label: 'Erros de IA', value: int(totals.llm_errors) },
    { label: 'Disjuntor acionado', value: int(totals.circuit_breaks) },
  ];

  return (
    <XJLayout
      title="Métricas"
      description="Agregados diários de atendimentos, custo com IA e conversão do agente autônomo"
      actions={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Ainda não há agregados para este escritório no período. O consolidado roda de hora em hora.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Atendimentos e turnos por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="sessions_started"
                      name="Iniciados"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                    />
                    <Area
                      type="monotone"
                      dataKey="turns"
                      name="Turnos"
                      stroke="hsl(var(--chart-2, var(--muted-foreground)))"
                      fill="hsl(var(--chart-2, var(--muted-foreground)) / 0.15)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Custo com IA por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: any) => usd(Number(value))}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost_usd"
                      name="Custo (US$)"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversão por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="qualified" name="Qualificados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="disqualified" name="Desqualificados" fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="contracts_sent" name="Contratos" fill="hsl(var(--primary) / 0.45)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="handoffs" name="Humano" fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </XJLayout>
  );
}
