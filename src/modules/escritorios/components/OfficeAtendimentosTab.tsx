import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useOfficeDashboard, type OfficePeriod } from '../hooks/useOfficeDashboard';

type PeriodKey = 'today' | 'yesterday' | '7d' | 'month' | 'last_month' | 'custom';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Mês atual' },
  { key: 'last_month', label: 'Mês anterior' },
  { key: 'custom', label: 'Personalizado' },
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computePeriod(key: PeriodKey, custom?: OfficePeriod): OfficePeriod {
  const now = new Date();
  const today = toDateStr(now);
  switch (key) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const s = toDateStr(y);
      return { startDate: s, endDate: s };
    }
    case '7d': {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      return { startDate: toDateStr(s), endDate: today };
    }
    case 'month':
      return { startDate: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toDateStr(first), endDate: toDateStr(last) };
    }
    case 'custom':
      return custom || { startDate: today, endDate: today };
  }
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string | number;
  icon: typeof Inbox;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function OfficeAtendimentosTab() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d');
  const [customPeriod, setCustomPeriod] = useState<OfficePeriod>(() => computePeriod('7d'));

  const period = useMemo(() => computePeriod(periodKey, customPeriod), [periodKey, customPeriod]);
  const { data: stats, isLoading } = useOfficeDashboard(period);

  const maxDay = Math.max(1, ...(stats?.byDay || []).map((d) => d.count));

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
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
            <div className="ml-2 flex items-center gap-2">
              <Input
                type="date"
                value={customPeriod.startDate}
                onChange={(e) => setCustomPeriod({ ...customPeriod, startDate: e.target.value })}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={customPeriod.endDate}
                onChange={(e) => setCustomPeriod({ ...customPeriod, endDate: e.target.value })}
                className="w-40"
              />
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Período: {period.startDate} → {period.endDate}
        </div>
      </Card>

      {isLoading || !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Atendimentos"
              value={stats.total}
              icon={Inbox}
              hint={`${period.startDate} → ${period.endDate}`}
            />
            <StatCard title="Em aberto" value={stats.open} icon={Activity} hint={`${stats.unassigned} sem responsável`} />
            <StatCard title="Aguardando" value={stats.pending} icon={Clock} />
            <StatCard title="Concluídos" value={stats.resolved} icon={CheckCircle2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Mensagens recebidas" value={stats.messagesIn} icon={MessageSquare} />
            <StatCard title="Mensagens enviadas" value={stats.messagesOut} icon={MessageSquare} />
            <StatCard
              title="1ª resposta (média)"
              value={stats.avgFirstResponseMin != null ? `${stats.avgFirstResponseMin} min` : '—'}
              icon={Clock}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimentos por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-1">
                {stats.byDay.map((day) => (
                  <div key={day.day} className="flex flex-1 flex-col items-center gap-1" title={`${day.day}: ${day.count}`}>
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(2, (day.count / maxDay) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{stats.byDay[0]?.day}</span>
                <span>{stats.byDay[stats.byDay.length - 1]?.day}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por fila</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.byQueue.slice(0, 6).map((item) => (
                  <div key={item.queue} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{item.queue}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <Progress value={(item.count / Math.max(1, stats.total)) * 100} />
                  </div>
                ))}
                {stats.byQueue.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por canal</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stats.byChannel.map((item) => (
                  <Badge key={item.channel} variant="secondary">
                    {item.channel}: {item.count}
                  </Badge>
                ))}
                {stats.byChannel.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Top atendentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topAgents.map((agent) => (
                  <div key={agent.agent} className="flex justify-between text-sm">
                    <span className="truncate">{agent.agent}</span>
                    <span className="text-muted-foreground">{agent.count}</span>
                  </div>
                ))}
                {stats.topAgents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum atendimento atribuído.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}