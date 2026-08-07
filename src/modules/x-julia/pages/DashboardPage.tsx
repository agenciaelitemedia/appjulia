import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { XJLayout } from '../components/XJLayout';
import { XJStageBadge } from '../components/XJStageBadge';
import { useXJSessions } from '../hooks/useXJSessions';
import { useXJAgents } from '../hooks/useXJAgents';
import { useXJFollowupQueue } from '../hooks/useXJFollowups';
import { XJ_STAGES, XJ_STAGE_LABELS, X_JULIA_ROUTES } from '../module';

export default function XJDashboardPage() {
  const { data: sessions = [], isLoading } = useXJSessions();
  const { data: agents = [] } = useXJAgents();
  const { data: followups = [] } = useXJFollowupQueue(200);

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.is_active);
    const qualified = sessions.filter((s) => s.qualification === 'qualificado');
    const contracts = sessions.filter((s) => s.stage === 'contrato' || s.stage === 'assinatura');
    const handoff = sessions.filter((s) => s.stage === 'humano');
    const pendingFollowups = followups.filter((f: any) => f.status === 'pending');
    return {
      total: sessions.length,
      active: active.length,
      qualified: qualified.length,
      contracts: contracts.length,
      handoff: handoff.length,
      followups: pendingFollowups.length,
      conversion: sessions.length ? Math.round((qualified.length / sessions.length) * 100) : 0,
    };
  }, [sessions, followups]);

  const byStage = useMemo(() => {
    return XJ_STAGES.map((stage) => ({
      stage,
      count: sessions.filter((s) => s.stage === stage).length,
    }));
  }, [sessions]);

  const maxStage = Math.max(1, ...byStage.map((s) => s.count));
  const recent = sessions.slice(0, 8);

  return (
    <XJLayout
      title="X-Julia"
      description="Agente jurídico autônomo — recepção, triagem, qualificação, contrato e agenda"
      actions={
        <Button asChild size="sm">
          <Link to={X_JULIA_ROUTES.agents}>Configurar agentes</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Atendimentos', value: stats.total },
          { label: 'Em andamento', value: stats.active },
          { label: 'Qualificados', value: stats.qualified },
          { label: 'Em contrato', value: stats.contracts },
          { label: 'Com humano', value: stats.handoff },
          { label: 'Followups pendentes', value: stats.followups },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-7 w-12" />
              ) : (
                <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funil por estágio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byStage.map(({ stage, count }) => (
              <div key={stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{XJ_STAGE_LABELS[stage]}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${(count / maxStage) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Últimos atendimentos</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={X_JULIA_ROUTES.sessions}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && recent.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum atendimento ainda. Vincule o agente a uma fila para começar.
              </p>
            )}
            {recent.map((session) => (
              <Link
                key={session.id}
                to={X_JULIA_ROUTES.session(session.id)}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.contact_name || session.phone || 'Sem nome'}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.case_type || 'Caso não identificado'}</p>
                </div>
                <XJStageBadge stage={session.stage} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {agents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum agente X-Julia configurado neste escritório.
            </p>
            <Button asChild size="sm">
              <Link to={X_JULIA_ROUTES.agents}>Criar primeiro agente</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </XJLayout>
  );
}