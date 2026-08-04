import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronRight, CheckCircle2, XCircle, Clock, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowRuns, type FlowRunFilters, type FlowRunRecord } from '../../hooks/useFlowRuns';

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

function formatDuration(ms?: number | null): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

function LogIcon({ status }: { status: string }) {
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === 'skipped') return <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
}

function RunItem({ run }: { run: FlowRunRecord }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[run.status] ?? { label: run.status, className: 'text-muted-foreground' };
  const total = formatDuration(run.duration_ms);
  const variableEntries = Object.entries(run.variables ?? {});
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
            {total ? ` · ${total}` : ''}
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
                <p className="flex items-center gap-1.5 text-[11px] font-medium leading-tight">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  {log.label || log.kind}
                  {formatDuration(log.duration_ms) && (
                    <span className="font-normal text-muted-foreground">({formatDuration(log.duration_ms)})</span>
                  )}
                </p>
                {log.detail && <p className="text-[11px] leading-snug text-muted-foreground">{log.detail}</p>}
              </div>
              {log.branch && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">{log.branch}</Badge>
              )}
            </div>
          ))}

          {variableEntries.length > 0 && (
            <div className="mt-2 rounded-md bg-muted/50 px-2 py-1.5">
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Variáveis finais</p>
              <div className="space-y-0.5">
                {variableEntries.map(([key, value]) => (
                  <p key={key} className="truncate text-[11px]">
                    <span className="font-medium">{key}</span>
                    <span className="text-muted-foreground">: {String(value ?? '')}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FlowRunsPanel({ flowId, open, onOpenChange }: FlowRunsPanelProps) {
  const [filters, setFilters] = useState<FlowRunFilters>({ status: 'all', mode: 'all', hours: 168 });
  const [search, setSearch] = useState('');
  const { data: runs = [], isLoading, refetch, isFetching } = useFlowRuns(flowId, { enabled: open, filters });

  const visibleRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return runs;
    return runs.filter((run) =>
      [run.trigger_event, run.error_message, run.status, ...run.node_logs.map((l) => `${l.label} ${l.detail ?? ''}`)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [runs, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Execuções</SheetTitle>
          <SheetDescription>Histórico das execuções desta automação, com tempo por bloco e erros.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2">
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="waiting">Aguardando</SelectItem>
              <SelectItem value="running">Em execução</SelectItem>
              <SelectItem value="failed">Com falha</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.mode} onValueChange={(v) => setFilters((f) => ({ ...f, mode: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Reais e simulações</SelectItem>
              <SelectItem value="real">Somente reais</SelectItem>
              <SelectItem value="simulation">Somente simulações</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(filters.hours ?? 0)}
            onValueChange={(v) => setFilters((f) => ({ ...f, hours: Number(v) }))}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Últimas 24h</SelectItem>
              <SelectItem value="168">Últimos 7 dias</SelectItem>
              <SelectItem value="720">Últimos 30 dias</SelectItem>
              <SelectItem value="0">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por evento, bloco ou erro"
            className="h-8 text-xs"
          />
          <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Atualizar
          </Button>
        </div>

        <ScrollArea className="-mx-2 flex-1 px-2">
          <div className="space-y-2 pb-6">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && visibleRuns.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Nenhuma execução encontrada com estes filtros.
              </p>
            )}
            {visibleRuns.map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
