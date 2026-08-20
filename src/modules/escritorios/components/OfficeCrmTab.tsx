import { useMemo, useState } from 'react';
import { Loader2, KanbanSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { MascoteLoader } from "@/components/ui/mascote-loader";

export function OfficeCrmTab() {
  const { data: clientId } = useOfficeClientId();
  const { codAgent } = useEscritoriosIdentity();
  const [selected, setSelected] = useState<string>('');

  const { boards = [], isLoading: boardsLoading } = useCRMBoards({
    clientId: clientId ? String(clientId) : '',
    codAgent: codAgent ? String(codAgent) : '',
    canManage: false,
  }) as any;

  // Sempre o primeiro quadro selecionado por padrão.
  const boardId = useMemo(() => {
    if (selected && boards.some((b: any) => b.id === selected)) return selected;
    return boards[0]?.id || '';
  }, [selected, boards]);

  const boardIds = useMemo(() => (boardId ? [boardId] : []), [boardId]);

  const { data: pipelines = [], isLoading: pipelinesLoading } = useOfficeCrmPipelines(
    clientId ? String(clientId) : null,
    boardIds,
  );
  const { data: deals = [], isLoading: dealsLoading } = useOfficeCrmDeals(
    clientId ? String(clientId) : null,
    boardIds,
  );

  const analytics = useCRMBoardAnalytics({
    deals: deals as any,
    pipelines: pipelines as any,
  });

  const isLoading = boardsLoading || pipelinesLoading || dealsLoading;

  if (boardsLoading) {
    return (
      <div className="flex justify-center py-20">
        <MascoteLoader size="xs" />
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
          {deals.length} card(s) · {pipelines.length} fase(s)
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="office-crm-board" className="text-sm font-medium">
            CRM
          </Label>
          <Select value={boardId} onValueChange={setSelected}>
            <SelectTrigger id="office-crm-board" className="w-64">
              <SelectValue placeholder="Selecionar quadro" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <MascoteLoader size="xs" />
        </div>
      ) : (
        <>
          <BoardSummaryCards analytics={analytics} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PipelineFunnelChart data={analytics.funnelData} />
            <PipelineAvgTimeChart data={analytics.pipelineStats} />
          </div>
          <DealsValueDistribution data={analytics.pipelineStats} />
        </>
      )}
    </div>
  );
}