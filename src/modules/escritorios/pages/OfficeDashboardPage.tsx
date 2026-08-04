import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Inbox,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useOfficeDashboard } from '../hooks/useOfficeDashboard';
import { useOfficeClientId } from '../hooks/useOfficeClientId';
import { useOfficeByClient } from '../hooks/useOffices';

const RANGES = [
  { label: '7 dias', value: 7 },
  { label: '15 dias', value: 15 },
  { label: '30 dias', value: 30 },
];

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

export default function OfficeDashboardPage() {
  const [days, setDays] = useState(30);
  const { data: clientId } = useOfficeClientId();
  const { data: office } = useOfficeByClient(clientId ? Number(clientId) : null);
  const { data: stats, isLoading } = useOfficeDashboard(days);

  const maxDay = Math.max(1, ...(stats?.byDay || []).map((d) => d.count));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6 text-primary" /> Painel de Atendimento
          </h1>
          <p className="text-sm text-muted-foreground">
            {office?.office_name ? `${office.office_name} · ` : ''}Indicadores de chat e atendimentos
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <Button
              key={range.value}
              size="sm"
              variant={days === range.value ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setDays(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Atendimentos" value={stats.total} icon={Inbox} hint={`Últimos ${days} dias`} />
            <StatCard title="Em aberto" value={stats.open} icon={Activity} hint={`${stats.unassigned} sem responsável`} />
            <StatCard title="Aguardando" value={stats.pending} icon={Clock} />
            <StatCard title="Concluídos" value={stats.resolved} icon={CheckCircle2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Mensagens recebidas"
              value={stats.messagesIn}
              icon={MessageSquare}
            />
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