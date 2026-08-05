import { useMemo, useState } from 'react';
import { Loader2, KanbanSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  useCRMBoards,
  useCRMBoardAnalytics,
  BoardSummaryCards,
  PipelineFunnelChart,
  PipelineAvgTimeChart,
  DealsValueDistribution,
} from '../extend/crm';
import { useOfficeClientId } from '../hooks/useOfficeClientId';
import { useOfficeCrmDeals, useOfficeCrmPipelines } from '../hooks/useOfficeCrmData';
import { useEscritoriosIdentity } from '../extend/auth';

const ALL = '__all__';

export function OfficeCrmTab() {
  const { data: clientId } = useOfficeClientId();
  const { codAgent } = useEscritoriosIdentity();
  const [boardId, setBoardId] = useState<string>(ALL);

  const { boards = [], isLoading: boardsLoading } = useCRMBoards({
    clientId: clientId ? String(clientId) : '',
    codAgent: codAgent ? String(codAgent) : '',
    canManage: false,
  }) as any;

  const boardIds = useMemo(
    () => (boardId === ALL ? boards.map((b: any) => b.id) : boards.some((b: any) => b.id === boardId) ? [boardId] : []),
    [boardId, boards],
  );

  const { data: pipelines = [], isLoading: pipelinesLoading } = useOfficeCrmPipelines(
    clientId ? String(clientId) : null,
    boardIds,
  );
  const { data: deals = [], isLoading: dealsLoading } = useOfficeCrmDeals(
    clientId ? String(clientId) : null,
    boardIds,
  );

  // Ao consolidar vários quadros, agrupamos as fases por nome para o funil não
  // repetir etapas equivalentes de quadros diferentes.
  const mergedPipelines = useMemo(() => {
    if (boardId !== ALL) return pipelines;
    const byName = new Map<string, any>();
    for (const p of pipelines as any[]) {
      if (!byName.has(p.name)) byName.set(p.name, p);
    }
    return Array.from(byName.values());
  }, [pipelines, boardId]);

  const nameByPipelineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines as any[]) map.set(p.id, p.name);
    return map;
  }, [pipelines]);

  const idByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of mergedPipelines as any[]) map.set(p.name, p.id);
    return map;
  }, [mergedPipelines]);

  const normalizedDeals = useMemo(() => {
    if (boardId !== ALL) return deals;
    return (deals as any[]).map((d) => {
      const name = nameByPipelineId.get(d.pipeline_id);
      const target = name ? idByName.get(name) : undefined;
      return target ? { ...d, pipeline_id: target } : d;
    });
  }, [deals, boardId, nameByPipelineId, idByName]);

  const analytics = useCRMBoardAnalytics({
    deals: normalizedDeals as any,
    pipelines: mergedPipelines as any,
  });

  const byBoard = useMemo(() => {
    const titles = new Map<string, string>(boards.map((b: any) => [b.id, b.name]));
    const map = new Map<string, number>();
    for (const d of deals as any[]) {
      const name = titles.get(d.board_id) || 'Sem quadro';
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [deals, boards]);

  const isLoading = boardsLoading || pipelinesLoading || dealsLoading;

  if (boardsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <KanbanSquare className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nenhum quadro de CRM encontrado</p>
          <p className="text-sm text-muted-foreground">
            Crie um quadro no Painel CRM para visualizar os indicadores aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {deals.length} card(s) · {mergedPipelines.length} fase(s)
        </p>
        <Select value={boardId} onValueChange={setBoardId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecionar quadro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os quadros</SelectItem>
            {boards.map((b: any) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <BoardSummaryCards analytics={analytics} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PipelineFunnelChart data={analytics.funnelData} />
            <PipelineAvgTimeChart data={analytics.pipelineStats} />
          </div>
          <DealsValueDistribution data={analytics.pipelineStats} />

          {boardId === ALL && byBoard.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cards por quadro</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={Math.max(180, byBoard.length * 40)}>
                  <BarChart data={byBoard} layout="vertical" margin={{ left: 0, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" name="Cards" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}