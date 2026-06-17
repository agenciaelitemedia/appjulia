import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, LineChart, Line, ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie,
} from 'recharts';
import {
  Clock, MessageSquare, CheckCircle2, RotateCcw,
  Phone, PhoneCall, Loader2, Download, Filter, TrendingUp, Target,
} from 'lucide-react';
import { useTeamPerformance, type PerformancePeriod } from '../hooks/useTeamPerformance';
import { EquipePerformanceDrawer } from './EquipePerformanceDrawer';
import { cn } from '@/lib/utils';

type PeriodKey = 'today' | 'yesterday' | '7d' | 'month' | 'last_month' | 'custom';

function computePeriod(key: PeriodKey, custom?: PerformancePeriod): PerformancePeriod {
  const now = new Date();
  const today = toBrtDateStr(now);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const yesterday = toBrtDateStr(yest);
  switch (key) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday':
      return { startDate: yesterday, endDate: yesterday };
    case '7d': {
      const start = new Date(now); start.setDate(now.getDate() - 6);
      return { startDate: toBrtDateStr(start), endDate: today };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toBrtDateStr(first), endDate: today };
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toBrtDateStr(first), endDate: toBrtDateStr(last) };
    }
    case 'custom':
      return custom || { startDate: today, endDate: today };
  }
}

function toBrtDateStr(d: Date): string {
  // crude BRT (-03:00)
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const brt = new Date(utc - 3 * 3600_000);
  return brt.toISOString().slice(0, 10);
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function fmtShortDate(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Mês atual' },
  { key: 'last_month', label: 'Mês anterior' },
  { key: 'custom', label: 'Personalizado' },
];

export function EquipePerformanceTab() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d');
  const [customPeriod, setCustomPeriod] = useState<PerformancePeriod>(() => computePeriod('7d'));
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);

  const period = useMemo(
    () => computePeriod(periodKey, customPeriod),
    [periodKey, customPeriod],
  );

  const { data, isLoading, allMembers = [] } = useTeamPerformance(
    period,
    selectedUserIds.length > 0 ? selectedUserIds : null,
  );

  const totals = data?.totals;
  const members = data?.members || [];
  const byDay = data?.byDayTotal || [];

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push('Atendente,Tempo logado,Ocupação %,Recebidas,Resolvidas,Devolvidas,Transferidas,TMA,Ligações,Atendidas,Talk time,Números únicos,Leads chamados');
    for (const m of members) {
      rows.push([
        m.name, fmtDuration(m.worked_seconds), m.occupancy_pct, m.received, m.resolved,
        m.returned, m.transferred, m.avg_handle_seconds ? fmtDuration(m.avg_handle_seconds) : '—',
        m.calls_total, m.calls_answered, fmtDuration(m.talk_seconds), m.unique_numbers, m.calls_to_known_leads,
      ].map(v => `"${v}"`).join(','));
    }
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `performance-equipe-${period.startDate}-${period.endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const drawerUser = drawerUserId ? members.find((m) => m.user_id === drawerUserId) : null;

  // Donut: distribuição de desfechos
  const outcomeData = useMemo(() => {
    if (!totals) return [];
    return [
      { name: 'Resolvidas', value: totals.resolved, color: 'hsl(160 60% 45%)' },
      { name: 'Devolvidas', value: totals.returned, color: 'hsl(35 90% 55%)' },
      { name: 'Transferidas', value: totals.transferred, color: 'hsl(220 70% 55%)' },
    ].filter((x) => x.value > 0);
  }, [totals]);

  // Scatter: ocupação × resolução
  const scatterData = useMemo(
    () => members
      .filter((m) => m.received > 0 || m.worked_seconds > 0)
      .map((m) => ({
        x: m.occupancy_pct,
        y: m.resolution_rate,
        z: Math.max(m.received, 5),
        name: m.name,
      })),
    [members],
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={periodKey === opt.key ? 'default' : 'outline'}
              onClick={() => setPeriodKey(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
          {periodKey === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <Input
                type="date"
                value={customPeriod.startDate}
                onChange={(e) => setCustomPeriod({ ...customPeriod, startDate: e.target.value })}
                className="w-40"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                value={customPeriod.endDate}
                onChange={(e) => setCustomPeriod({ ...customPeriod, endDate: e.target.value })}
                className="w-40"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <UserMultiSelect
              members={allMembers}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
            />
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!data}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Período: {period.startDate} → {period.endDate}
          {selectedUserIds.length > 0 && ` • ${selectedUserIds.length} atendente(s) selecionado(s)`}
          <span className="ml-2 italic">Dados atualizados a cada 5 minutos.</span>
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && totals && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Clock} label="Tempo logado" value={fmtDuration(totals.worked_seconds)} sub={`${totals.sessions_count} sessões`} accent="text-blue-600 bg-blue-50 dark:bg-blue-950/30" />
            <KpiCard icon={MessageSquare} label="Recebidos" value={totals.received} sub={`${members.length} atendentes`} accent="text-violet-600 bg-violet-50 dark:bg-violet-950/30" />
            <KpiCard icon={CheckCircle2} label="Resolvidos" value={totals.resolved} sub={`${totals.resolution_rate}% de resolução`} accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" />
            <KpiCard icon={RotateCcw} label="Devolvidos" value={totals.returned} sub={`${totals.transferred} transferidos`} accent="text-amber-600 bg-amber-50 dark:bg-amber-950/30" />
            <KpiCard icon={Target} label="TMA médio" value={totals.received > 0 && members.length > 0 ? fmtDuration(Math.round(members.reduce((s, m) => s + (m.avg_handle_seconds || 0), 0) / Math.max(1, members.filter((m) => m.avg_handle_seconds).length))) : '—'} sub="tempo p/ resolver" accent="text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" />
            <KpiCard icon={Phone} label="Ligações" value={totals.calls_total} sub={`${totals.calls_answered} atendidas`} accent="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" />
            <KpiCard icon={PhoneCall} label="Talk time" value={fmtDuration(totals.talk_seconds)} sub={`${totals.calls_to_known_leads} p/ leads`} accent="text-rose-600 bg-rose-50 dark:bg-rose-950/30" />
            <KpiCard icon={TrendingUp} label="Ocupação" value={`${totals.occupancy_pct}%`} sub="talk / logado" accent="text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30" />
          </div>

          {/* Gráficos linha 1: stacked bar + donut */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-semibold mb-3 text-sm">Volume diário de atendimentos</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay.map((d) => ({ ...d, day: fmtShortDate(d.day), worked_hours: +(d.worked_seconds / 3600).toFixed(1) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} unit="h" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="resolved" name="Resolvidas" stackId="a" fill="hsl(160 60% 45%)" />
                    <Bar yAxisId="left" dataKey="returned" name="Devolvidas" stackId="a" fill="hsl(35 90% 55%)" />
                    <Bar yAxisId="left" dataKey="transferred" name="Transferidas" stackId="a" fill="hsl(220 70% 55%)" />
                    <Line yAxisId="right" type="monotone" dataKey="worked_hours" name="Horas logadas" stroke="hsl(280 60% 55%)" strokeWidth={2} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-sm">Distribuição de desfechos</h3>
              <div className="h-72">
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                        {outcomeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>
                )}
              </div>
            </Card>
          </div>

          {/* Scatter: Ocupação × Resolução */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm">Ocupação × Resolução por atendente</h3>
            <p className="text-xs text-muted-foreground mb-2">Quanto mais para cima e à direita, melhor. Tamanho do ponto = volume recebido.</p>
            <div className="h-64">
              {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" dataKey="x" name="Ocupação" unit="%" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                    <YAxis type="number" dataKey="y" name="Resolução" unit="%" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                    <ZAxis type="number" dataKey="z" range={[60, 400]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      const p = payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div className="bg-popover border border-border rounded p-2 text-xs">
                          <div className="font-medium">{p.name}</div>
                          <div>Ocupação: {p.x}%</div>
                          <div>Resolução: {p.y}%</div>
                          <div>Recebidos: {p.z}</div>
                        </div>
                      );
                    }} />
                    <Scatter data={scatterData} fill="hsl(var(--primary))" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>
              )}
            </div>
          </Card>

          {/* Ranking */}
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Ranking por atendente</h3>
              <p className="text-xs text-muted-foreground">Clique em uma linha para ver detalhes.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atendente</TableHead>
                    <TableHead className="text-right">Tempo logado</TableHead>
                    <TableHead className="text-right">Ocup.</TableHead>
                    <TableHead className="text-right">Receb.</TableHead>
                    <TableHead className="text-right">Resolv.</TableHead>
                    <TableHead className="text-right">Devol.</TableHead>
                    <TableHead className="text-right">Transf.</TableHead>
                    <TableHead className="text-right">TMA</TableHead>
                    <TableHead className="text-right">Ligações</TableHead>
                    <TableHead className="text-right">Talk time</TableHead>
                    <TableHead className="text-right">Leads chamados</TableHead>
                    <TableHead className="w-32">Tendência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        Nenhum dado no período
                      </TableCell>
                    </TableRow>
                  ) : members.map((m) => (
                    <TableRow key={m.user_id} className="cursor-pointer" onClick={() => setDrawerUserId(m.user_id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {m.photo && <AvatarImage src={m.photo} alt={m.name} />}
                            <AvatarFallback className="text-[10px]">
                              {m.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtDuration(m.worked_seconds)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn('font-mono text-xs', m.occupancy_pct >= 50 ? 'border-emerald-500/40 text-emerald-700' : 'text-muted-foreground')}>
                          {m.occupancy_pct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.received}</TableCell>
                      <TableCell className="text-right text-emerald-700">{m.resolved}</TableCell>
                      <TableCell className="text-right text-amber-700">{m.returned}</TableCell>
                      <TableCell className="text-right text-blue-700">{m.transferred}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {m.avg_handle_seconds ? fmtDuration(m.avg_handle_seconds) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{m.calls_total}</TableCell>
                      <TableCell className="text-right text-sm">{fmtDuration(m.talk_seconds)}</TableCell>
                      <TableCell className="text-right">
                        {m.calls_to_known_leads > 0 ? (
                          <Badge variant="outline" className="border-rose-500/40 text-rose-700 text-xs">
                            {m.calls_to_known_leads}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <MiniSparkline data={m.trend_received} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {drawerUser && (
        <EquipePerformanceDrawer
          open={!!drawerUserId}
          onOpenChange={(o) => !o && setDrawerUserId(null)}
          user={drawerUser}
          period={period}
        />
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: any; sub?: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-xl font-semibold leading-tight truncate">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function UserMultiSelect({ members, selected, onChange }: {
  members: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? 'Todos atendentes' : `${selected.length} selecionado(s)`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-medium">Filtrar atendentes</span>
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange([])} className="h-6 text-xs">Limpar</Button>
          )}
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {members.map((m) => {
              const checked = selected.includes(m.id);
              return (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      if (v) onChange([...selected, m.id]);
                      else onChange(selected.filter((x) => x !== m.id));
                    }}
                  />
                  <span className="text-sm truncate">{m.name}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}