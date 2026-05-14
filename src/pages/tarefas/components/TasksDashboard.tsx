import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskPoints, PointsPeriod } from '@/hooks/useTaskPoints';
import { useTasks } from '@/hooks/useTasks';
import { TaskRankingBoard } from './TaskRankingBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy, Star, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERIODS: { value: PointsPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Tudo' },
];

export function TasksDashboard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : undefined;
  const userId = user?.id ? String(user.id) : undefined;

  const [period, setPeriod] = useState<PointsPeriod>('month');
  const { ranking, myScore, myRank, weeklyChart, isLoading } = useTaskPoints(clientId, period, userId);

  const { tasks: myTasks, isLoading: tasksLoading } = useTasks({
    clientId,
    assignedTo: userId,
  });

  const pendingCount = myTasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = myTasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = myTasks.filter((t) => t.status === 'completed').length;

  if (isLoading && tasksLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartMax = Math.max(...weeklyChart.map((w) => w.points), 1);

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 lg:col-span-1 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{myScore}</p>
                <p className="text-xs text-muted-foreground">Seus pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myRank ? `${myRank}º` : '—'}</p>
                <p className="text-xs text-muted-foreground">Sua posição</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-2">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount + inProgressCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ranking da equipe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Ranking da equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskRankingBoard ranking={ranking} myUserId={userId} />
          </CardContent>
        </Card>

        {/* Gráfico semanal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Seus pontos por semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-32">
              {weeklyChart.map((w) => {
                const pct = Math.max((w.points / chartMax) * 100, w.points > 0 ? 4 : 0);
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">{w.points > 0 ? w.points : ''}</span>
                    <div className="w-full rounded-t transition-all" style={{ height: `${pct}%`, minHeight: w.points > 0 ? 4 : 0, backgroundColor: '#6366f1' }} />
                    <span className="text-[10px] text-muted-foreground">{w.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
