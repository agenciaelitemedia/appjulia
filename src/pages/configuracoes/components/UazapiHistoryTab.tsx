import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, Eye, CheckCircle2, AlertCircle, MinusCircle, Clock, XCircle, Ban, PlayCircle, AlertTriangle, Zap, Activity, Gauge } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUazapiHistoryRuns, useUazapiHistoryItems, useUazapiHistoryPending, useUazapiQueues, useDispatcherHealth, useUazapiPendingByClient, type UazapiHistoryRun } from '../hooks/useUazapiHistoryRuns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.max(0, e - s);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function RunStatusBadge({ status }: { status: UazapiHistoryRun['status'] }) {
  const map = {
    pending: { label: 'Aguardando', cls: 'bg-muted text-muted-foreground', icon: Clock, spin: false },
    running: { label: 'Processando', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2, spin: true },
    done: { label: 'Concluído', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2, spin: false },
    partial: { label: 'Parcial', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertCircle, spin: false },
    error: { label: 'Erro', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle, spin: false },
  } as const;
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
      <Icon className={`h-3 w-3 ${cfg.spin ? 'animate-spin' : ''}`} /> {cfg.label}
    </Badge>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: 'Pendente', cls: 'bg-muted text-muted-foreground', icon: Clock },
    ok: { label: 'Inseridas', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
    skipped: { label: 'Sem novidades', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: MinusCircle },
    error: { label: 'Erro', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  };
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

function RunDetails({ run, open, onOpenChange }: {
  run: UazapiHistoryRun | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: items = [], isLoading } = useUazapiHistoryItems(open ? run?.id ?? null : null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Detalhes do lote do history</SheetTitle>
          <SheetDescription>
            {run ? `${run.queue_name || run.queue_id || '—'} · ${run.individual_chats} conversas` : ''}
          </SheetDescription>
        </SheetHeader>

        {run && (
          <div className="grid grid-cols-4 gap-2 py-4 text-center">
            <div className="border rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Recebidas</div>
              <div className="text-base font-semibold">{run.total_messages}</div>
            </div>
            <div className="border rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Inseridas</div>
              <div className="text-base font-semibold">{run.inserted_messages}</div>
            </div>
            <div className="border rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Duplicadas</div>
              <div className="text-base font-semibold">{run.duplicate_messages}</div>
            </div>
            <div className="border rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Grupos ignorados</div>
              <div className="text-base font-semibold">{run.group_messages}</div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Sem itens.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conversa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recebidas</TableHead>
                  <TableHead className="text-right">Inseridas</TableHead>
                  <TableHead className="text-right">Duplicadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs truncate max-w-[180px]" title={it.remote_jid}>
                      {it.phone || it.remote_jid}
                      {it.contact_created && (
                        <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0">novo</Badge>
                      )}
                    </TableCell>
                    <TableCell><ItemStatusBadge status={it.status} /></TableCell>
                    <TableCell className="text-right">{it.received_messages}</TableCell>
                    <TableCell className="text-right">{it.inserted_messages}</TableCell>
                    <TableCell className="text-right">{it.duplicate_messages}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function UazapiHistoryTab() {
  const { data: runs = [], isLoading } = useUazapiHistoryRuns();
  const { data: pending } = useUazapiHistoryPending();
  const { data: queues = [] } = useUazapiQueues();
  const { data: dispatcher } = useDispatcherHealth();
  const { data: pendingByClient = [] } = useUazapiPendingByClient();
  const queryClient = useQueryClient();
  const [resuming, setResuming] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [restartingDispatcher, setRestartingDispatcher] = useState(false);
  const [resyncQueueId, setResyncQueueId] = useState<string>('');
  const [selected, setSelected] = useState<UazapiHistoryRun | null>(null);
  const [open, setOpen] = useState(false);

  const handleResume = async () => {
    setResuming(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-history-resume', {
        body: { force: true, batch_size: 100, max_total: 1000 },
      });
      if (error) throw error;
      const inserted = (data as any)?.inserted ?? 0;
      const picked = (data as any)?.picked ?? 0;
      toast.success(`Reprocessamento disparado: ${picked} item(ns) processado(s), ${inserted} mensagem(ns) inserida(s).`);
      queryClient.invalidateQueries({ queryKey: ['uazapi-history-pending'] });
      queryClient.invalidateQueries({ queryKey: ['uazapi-history-runs'] });
    } catch (err) {
      toast.error(`Falha ao reprocessar: ${(err as Error).message}`);
    } finally {
      setResuming(false);
    }
  };

  const handleRestartDispatcher = async () => {
    setRestartingDispatcher(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-history-dispatcher', {
        body: { action: 'tick' },
      });
      if (error) throw error;
      const fired = (data as any)?.fired ?? 0;
      const pendingNow = (data as any)?.pending ?? 0;
      toast.success(`Dispatcher acionado: ${fired} worker(s) em paralelo · ${pendingNow.toLocaleString('pt-BR')} pendentes.`);
      queryClient.invalidateQueries({ queryKey: ['uazapi-dispatcher-heartbeat'] });
      queryClient.invalidateQueries({ queryKey: ['uazapi-history-pending'] });
    } catch (err) {
      toast.error(`Falha ao acionar dispatcher: ${(err as Error).message}`);
    } finally {
      setRestartingDispatcher(false);
    }
  };

  const handleForceResync = async () => {
    const queueId = resyncQueueId || (queues.length === 1 ? queues[0].id : '');
    if (!queueId) {
      toast.error('Selecione a fila UaZapi para forçar o resync.');
      return;
    }
    setResyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-history-force-resync', {
        body: { queue_id: queueId },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast.success(
        `Resync solicitado para "${d?.queue_name ?? queueId}". A UaZapi deve reenviar o histórico em alguns segundos — atualize esta aba.`,
        { duration: 6000 },
      );
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['uazapi-history-runs'] });
        queryClient.invalidateQueries({ queryKey: ['uazapi-history-pending'] });
      }, 4000);
    } catch (err) {
      toast.error(`Falha ao forçar resync: ${(err as Error).message}`);
    } finally {
      setResyncing(false);
    }
  };

  const stats = useMemo(() => {
    const counts = { pending: 0, running: 0, done: 0, partial: 0, error: 0 };
    let totalReceived = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalGroups = 0;
    let totalSkippedLid = 0;
    let lastReceivedAt: string | null = null;
    let lastFinishedAt: string | null = null;
    let oldestRunningAt: string | null = null;
    for (const r of runs) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      totalReceived += r.total_messages || 0;
      totalInserted += r.inserted_messages || 0;
      totalDuplicates += r.duplicate_messages || 0;
      totalGroups += r.group_messages || 0;
      totalSkippedLid += r.skipped_lid || 0;
      if (!lastReceivedAt || r.received_at > lastReceivedAt) lastReceivedAt = r.received_at;
      if (r.finished_at && (!lastFinishedAt || r.finished_at > lastFinishedAt)) lastFinishedAt = r.finished_at;
      if (r.status === 'running' && r.started_at) {
        if (!oldestRunningAt || r.started_at < oldestRunningAt) oldestRunningAt = r.started_at;
      }
    }
    return { counts, totalReceived, totalInserted, totalDuplicates, totalGroups, totalSkippedLid, lastReceivedAt, lastFinishedAt, oldestRunningAt };
  }, [runs]);

  const fmtTs = (v: string | null) =>
    v ? format(new Date(v), "dd/MM HH:mm:ss", { locale: ptBR }) : '—';

  const statCards: Array<{ key: keyof typeof stats.counts; label: string; cls: string; icon: any; spin?: boolean }> = [
    { key: 'pending', label: 'Aguardando', cls: 'bg-muted text-muted-foreground border-border', icon: Clock },
    { key: 'running', label: 'Processando', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2, spin: true },
    { key: 'done', label: 'Concluídos', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
    { key: 'partial', label: 'Parciais', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertCircle },
    { key: 'error', label: 'Erros', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Histórico do evento UaZapi</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe os lotes do evento <strong>history</strong> recebidos da UaZapi por fila de conexão.
            Apenas mensagens que ainda não existem são inseridas — grupos são sempre ignorados e nada é marcado como não lido.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex gap-2 items-center">
            {queues.length > 1 && (
              <Select value={resyncQueueId} onValueChange={setResyncQueueId}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Selecione a fila..." />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleForceResync}
              disabled={resyncing || queues.length === 0}
              className="gap-2"
              title="Faz disconnect+connect na UaZapi para que ela reenvie o histórico"
            >
              {resyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Forçar resync de histórico
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResume}
            disabled={resuming}
            className="gap-2"
          >
            {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Reprocessar pendentes
          </Button>
        </div>
      </div>

      {!isLoading && runs.length === 0 && queues.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <div className="flex-1 text-sm">
            <strong className="text-blue-700">Nenhum histórico recebido ainda.</strong>
            <div className="text-muted-foreground mt-0.5">
              A UaZapi só envia histórico quando a sessão (re)conecta após estar desconectada.
              Use <strong>Forçar resync de histórico</strong> acima para que ela reenvie o burst de mensagens.
              Em seguida o cron drena os items em lotes de 5/min sem saturar o servidor.
            </div>
          </div>
        </div>
      )}

      {pending && pending.pending > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <strong className="text-amber-700">{pending.pending.toLocaleString('pt-BR')} item(ns) aguardando processamento</strong>
            {pending.oldest_pending_at && (
              <span className="text-muted-foreground">
                {' '}· mais antigo desde {format(new Date(pending.oldest_pending_at), "dd/MM HH:mm:ss", { locale: ptBR })}
              </span>
            )}
            <div className="text-xs text-muted-foreground mt-0.5">
              O worker automático drena 5 itens por minuto. Use o botão para forçar uma rodada maior agora.
            </div>
          </div>
        </div>
      )}

      {!isLoading && runs.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {statCards.map(({ key, label, cls, icon: Icon, spin }) => (
              <div key={key} className={`border rounded-lg p-3 ${cls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</span>
                  <Icon className={`h-3.5 w-3.5 ${spin && stats.counts[key] > 0 ? 'animate-spin' : ''}`} />
                </div>
                <div className="text-2xl font-bold mt-1">{stats.counts[key]}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Último recebido</div>
              <div className="text-sm font-semibold mt-1 text-foreground">{fmtTs(stats.lastReceivedAt)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Último concluído</div>
              <div className="text-sm font-semibold mt-1 text-foreground">{fmtTs(stats.lastFinishedAt)}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mais antigo em execução</div>
              <div className="text-sm font-semibold mt-1 text-foreground">{fmtTs(stats.oldestRunningAt)}</div>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="border rounded-lg p-3 bg-orange-500/5 border-orange-500/20 cursor-help">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-orange-700">Descartadas (LID)</span>
                      <Ban className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <div className="text-2xl font-bold mt-1 text-orange-600">{stats.totalSkippedLid.toLocaleString('pt-BR')}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Mensagens recebidas sem número real do WhatsApp (identificador interno @lid). São ignoradas para evitar criar contatos sem telefone válido.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mensagens (recebidas / inseridas)</div>
              <div className="text-sm font-semibold mt-1 text-foreground">
                {stats.totalReceived.toLocaleString('pt-BR')} / <span className="text-green-600">{stats.totalInserted.toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {stats.totalDuplicates.toLocaleString('pt-BR')} duplicadas · {stats.totalGroups.toLocaleString('pt-BR')} grupos ignorados
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-1 font-medium">Nenhum evento history recebido</p>
          <p className="text-sm">Quando a UaZapi enviar um lote de history, ele aparece aqui automaticamente.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Fila / Conexão</TableHead>
                <TableHead className="text-center">Conversas</TableHead>
                <TableHead className="text-right">Recebidas</TableHead>
                <TableHead className="text-right">Processadas</TableHead>
                <TableHead className="text-right">Inseridas</TableHead>
                <TableHead className="text-right">Duplicadas</TableHead>
                <TableHead className="text-right">Grupos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(run.received_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium truncate max-w-[180px]">{run.queue_name || run.queue_id || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">{run.client_name || run.client_id}</div>
                  </TableCell>
                  <TableCell className="text-center text-xs">{run.processed_chats}/{run.individual_chats}</TableCell>
                  <TableCell className="text-right">{run.total_messages}</TableCell>
                  <TableCell className="text-right">{run.processed_chats}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">{run.inserted_messages}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{run.duplicate_messages}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{run.group_messages}</TableCell>
                  <TableCell><RunStatusBadge status={run.status} /></TableCell>
                  <TableCell className="text-right text-xs">{formatDuration(run.started_at, run.finished_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setSelected(run); setOpen(true); }} title="Ver itens">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RunDetails run={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}