import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox, AlertTriangle, CheckCircle2, Clock, Star } from 'lucide-react';
import { useTickets, useSupportConfig, isOverdue } from '../hooks/useTickets';
import { STATUS_LABEL, type TicketStatus } from '../types';

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: string | number; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TicketsDashboard() {
  const { tickets, isLoading } = useTickets({});
  const { departments } = useSupportConfig();

  const stats = useMemo(() => {
    const open = tickets.filter((t) => !['resolved', 'closed'].includes(t.status));
    const overdue = open.filter(isOverdue);
    const todayStr = new Date().toDateString();
    const resolvedToday = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at).toDateString() === todayStr);

    // TMR 1ª resposta (média em horas) sobre tickets com first_response_at
    const responded = tickets.filter((t) => t.first_response_at && t.opened_at);
    const avgFirstRespH = responded.length
      ? responded.reduce((sum, t) => sum + (new Date(t.first_response_at!).getTime() - new Date(t.opened_at!).getTime()), 0) / responded.length / 3600000
      : 0;

    const rated = tickets.filter((t) => t.csat_score != null);
    const avgCsat = rated.length ? rated.reduce((s, t) => s + (t.csat_score ?? 0), 0) / rated.length : 0;

    const byStatus = {} as Record<TicketStatus, number>;
    for (const t of tickets) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    const byDept = departments.map((d) => ({
      name: d.name,
      count: open.filter((t) => t.department_id === d.id).length,
    })).filter((d) => d.count > 0);

    return { openCount: open.length, overdue: overdue.length, resolvedToday: resolvedToday.length, avgFirstRespH, avgCsat, byStatus, byDept };
  }, [tickets, departments]);

  if (isLoading) {
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={Inbox} label="Abertos" value={stats.openCount} tone="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" />
        <Metric icon={AlertTriangle} label="Atrasados (SLA)" value={stats.overdue} tone="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
        <Metric icon={CheckCircle2} label="Resolvidos hoje" value={stats.resolvedToday} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
        <Metric icon={Clock} label="TMR 1ª resposta" value={stats.avgFirstRespH ? `${stats.avgFirstRespH.toFixed(1)}h` : '—'} tone="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" />
        <Metric icon={Star} label="CSAT médio" value={stats.avgCsat ? `${stats.avgCsat.toFixed(1)}/5` : '—'} tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Por status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => {
              const count = stats.byStatus[s] ?? 0;
              const pct = tickets.length ? (count / tickets.length) * 100 : 0;
              return (
                <div key={s} className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{STATUS_LABEL[s]}</span><span className="text-muted-foreground">{count}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Abertos por departamento</CardTitle></CardHeader>
          <CardContent>
            {stats.byDept.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem chamados abertos por departamento.</p>
            ) : (
              <div className="space-y-2">
                {stats.byDept.map((d) => (
                  <div key={d.name} className="flex justify-between text-sm"><span>{d.name}</span><span className="font-medium">{d.count}</span></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
