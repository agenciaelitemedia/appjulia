import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XJLayout } from '../components/XJLayout';
import { XJStageBadge } from '../components/XJStageBadge';
import { useXJDealActions, useXJDeals, useXJPipelines } from '../hooks/useXJCrm';
import { useXJPermissions } from '../extend/auth';
import { X_JULIA_ROUTES } from '../module';

const currency = (value: number | null) =>
  typeof value === 'number'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

export default function XJCrmPage() {
  const { data: pipelines = [], isLoading: loadingPipelines } = useXJPipelines();
  const { data: deals = [], isLoading: loadingDeals } = useXJDeals();
  const { move } = useXJDealActions();
  const permissions = useXJPermissions('x_julia_crm');

  const grouped = useMemo(() => {
    const map = new Map<string, typeof deals>();
    pipelines.forEach((p) => map.set(p.id, []));
    deals.forEach((deal) => {
      const key = deal.pipeline_id ?? 'sem-etapa';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(deal);
    });
    return map;
  }, [pipelines, deals]);

  const isLoading = loadingPipelines || loadingDeals;

  return (
    <XJLayout title="CRM X-Julia" description="Cards criados e movimentados pelo agente autônomo">
      {isLoading && <Skeleton className="h-72 w-full" />}

      {!isLoading && pipelines.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma etapa configurada. As etapas são criadas junto com o primeiro agente X-Julia.
          </CardContent>
        </Card>
      )}

      {!isLoading && pipelines.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipelines.map((pipeline) => {
            const items = grouped.get(pipeline.id) ?? [];
            return (
              <div key={pipeline.id} className="w-72 shrink-0 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between gap-2 border-b p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pipeline.color }} />
                    <span className="text-sm font-medium">{pipeline.name}</span>
                  </div>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-2 p-2">
                  {items.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground">Nenhum card nesta etapa.</p>
                  )}
                  {items.map((deal) => (
                    <div key={deal.id} className="rounded-md border bg-background p-2.5">
                      <p className="truncate text-sm font-medium">{deal.title || deal.contact_name || 'Sem título'}</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.phone ?? '—'} · {currency(deal.value)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {deal.case_type && <Badge variant="outline" className="text-[10px]">{deal.case_type}</Badge>}
                        {deal.stage && <XJStageBadge stage={deal.stage as any} />}
                      </div>
                      {deal.session_id && (
                        <Link
                          to={X_JULIA_ROUTES.session(deal.session_id)}
                          className="mt-2 block text-xs text-primary hover:underline"
                        >
                          Ver atendimento
                        </Link>
                      )}
                      {permissions.canEdit && (
                        <Select
                          value={deal.pipeline_id ?? ''}
                          onValueChange={(v) =>
                            move.mutate({ dealId: deal.id, pipelineId: v, fromPipelineId: deal.pipeline_id })
                          }
                        >
                          <SelectTrigger className="mt-2 h-8 text-xs">
                            <SelectValue placeholder="Mover para..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </XJLayout>
  );
}