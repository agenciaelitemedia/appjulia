import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle, MinusCircle, Clock } from 'lucide-react';
import { useWhatsappSyncJobLogs, type WhatsappSyncJob } from '../hooks/useWhatsappSyncJobs';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: 'Pendente', cls: 'bg-muted text-muted-foreground', icon: Clock },
    ok: { label: 'OK', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
    error: { label: 'Erro', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
    skipped: { label: 'Sem mensagens', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: MinusCircle },
  };
  const cfg = map[status] || map.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

export function SyncHistoryLogsDrawer({
  job,
  open,
  onOpenChange,
}: {
  job: WhatsappSyncJob | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: logs = [], isLoading } = useWhatsappSyncJobLogs(open ? job?.id ?? null : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Logs de sincronização</SheetTitle>
          <SheetDescription>
            {job ? `${job.client_name || job.client_id} · ${job.queue_name || job.queue_id} · ${job.total_numbers} números` : ''}
          </SheetDescription>
        </SheetHeader>

        {job && (
          <div className="grid grid-cols-3 gap-2 py-4 text-center">
            <div className="border rounded-lg p-2">
              <div className="text-xs text-muted-foreground">Processados</div>
              <div className="text-lg font-semibold">{job.processed_numbers}/{job.total_numbers}</div>
            </div>
            <div className="border rounded-lg p-2">
              <div className="text-xs text-muted-foreground">Mensagens</div>
              <div className="text-lg font-semibold">{job.inserted_messages}</div>
            </div>
            <div className="border rounded-lg p-2">
              <div className="text-xs text-muted-foreground">Contatos novos</div>
              <div className="text-lg font-semibold">{job.inserted_contacts}</div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Sem logs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Encontradas</TableHead>
                  <TableHead className="text-right">Inseridas</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.phone}</TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="text-right">{log.messages_found}</TableCell>
                    <TableCell className="text-right">{log.messages_inserted}</TableCell>
                    <TableCell className="text-xs text-red-600 truncate max-w-[200px]" title={log.error || ''}>
                      {log.error || ''}
                    </TableCell>
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