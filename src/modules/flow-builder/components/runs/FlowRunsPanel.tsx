import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, CheckCircle2, XCircle, Clock, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowRuns, type FlowRunRecord } from '../../hooks/useFlowRuns';

interface FlowRunsPanelProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'border-emerald-500/40 text-emerald-600' },
  running: { label: 'Em execução', className: 'border-sky-500/40 text-sky-600' },
  waiting: { label: 'Aguardando', className: 'border-amber-500/40 text-amber-600' },
  failed: { label: 'Falhou', className: 'border-destructive/40 text-destructive' },
};

function formatDateTime(value: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function LogIcon({ status }: { status: string }) {
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === 'skipped') return <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
}

function RunItem({ run }: { run: FlowRunRecord }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[run.status] ?? { label: run.status, className: 'text-muted-foreground' };
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {run.trigger_event || 'execução'}
            {run.is_simulation && <span className="ml-1 text-muted-foreground">(simulação)</span>}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDateTime(run.started_at)} · {run.node_logs.length} bloco(s)
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>
          {meta.label}
        </Badge>
      </button>
      {expanded && (
        <div className="space-y-1.5 border-t px-3 py-2.5">
          {run.error_message && (
            <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{run.error_message}</p>
          )}
          {run.node_logs.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Sem registros de blocos nesta execução.</p>
          )}
          {run.node_logs.map((log, index) => (
            <div key={`${log.node_id}-${index}`} className="flex items-start gap-2">
              <span className="pt-0.5"><LogIcon status={log.status} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-tight">{log.label || log.kind}</p>
                {log.detail && <p className="text-[11px] leading-snug text-muted-foreground">{log.detail}</p>}
              </div>
              {log.branch && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">{log.branch}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlowRunsPanel({ flowId, open, onOpenChange }: FlowRunsPanelProps) {
  const { data: runs = [], isLoading, refetch, isFetching } = useFlowRuns(flowId, { enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Execuções</SheetTitle>
          <SheetDescription>Histórico das últimas 50 execuções desta automação, bloco a bloco.</SheetDescription>
        </SheetHeader>

        <Button variant="outline" size="sm" className="w-fit rounded-full" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Atualizar
        </Button>

        <ScrollArea className="-mx-2 flex-1 px-2">
          <div className="space-y-2 pb-6">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && runs.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Nenhuma execução registrada ainda.
              </p>
            )}
            {runs.map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
