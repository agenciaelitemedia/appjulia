import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, Eye, CheckCircle2, AlertCircle, MinusCircle, Clock, XCircle } from 'lucide-react';
import { useUazapiHistoryRuns, useUazapiHistoryItems, type UazapiHistoryRun } from '../hooks/useUazapiHistoryRuns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [selected, setSelected] = useState<UazapiHistoryRun | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Histórico do evento UaZapi</h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe os lotes do evento <strong>history</strong> recebidos da UaZapi por fila de conexão.
          Apenas mensagens que ainda não existem são inseridas — grupos são sempre ignorados e nada é marcado como não lido.
        </p>
      </div>

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