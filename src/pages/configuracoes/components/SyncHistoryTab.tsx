import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, Eye, X, CheckCircle2, AlertCircle, Clock, Ban } from 'lucide-react';
import { useWhatsappSyncJobs, useCancelSyncJob, type WhatsappSyncJob } from '../hooks/useWhatsappSyncJobs';
import { SyncHistoryLogsDrawer } from './SyncHistoryLogsDrawer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = (end ? new Date(end).getTime() : Date.now());
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

function JobStatusBadge({ status }: { status: WhatsappSyncJob['status'] }) {
  const map = {
    running: { label: 'Em execução', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2, spin: true },
    done: { label: 'Concluído', cls: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2, spin: false },
    partial: { label: 'Parcial', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertCircle, spin: false },
    error: { label: 'Erro', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertCircle, spin: false },
    cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground', icon: Ban, spin: false },
  } as const;
  const cfg = map[status] || map.running;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
      <Icon className={`h-3 w-3 ${cfg.spin ? 'animate-spin' : ''}`} /> {cfg.label}
    </Badge>
  );
}

export function SyncHistoryTab() {
  const { data: jobs = [], isLoading } = useWhatsappSyncJobs();
  const cancelJob = useCancelSyncJob();
  const [selectedJob, setSelectedJob] = useState<WhatsappSyncJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openLogs = (job: WhatsappSyncJob) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Histórico de Sincronização</h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe a importação de mensagens em background — atualiza automaticamente a cada 5 segundos
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-1 font-medium">Nenhuma sincronização registrada</p>
          <p className="text-sm">Inicie uma sincronização na aba "Sincronizar WhatsApp"</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Início</TableHead>
                <TableHead>Cliente / Fila</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Progresso</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(job.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium truncate max-w-[180px]">{job.client_name || job.client_id}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">{job.queue_name || '—'}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="truncate max-w-[140px]">{job.agent_name || job.cod_agent || '—'}</div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {job.date_from && job.date_to
                      ? `${format(new Date(job.date_from), 'dd/MM/yy')} → ${format(new Date(job.date_to), 'dd/MM/yy')}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center text-xs whitespace-nowrap">
                    {job.processed_numbers}/{job.total_numbers}
                  </TableCell>
                  <TableCell className="text-right">{job.inserted_messages}</TableCell>
                  <TableCell><JobStatusBadge status={job.status} /></TableCell>
                  <TableCell className="text-right text-xs">{formatDuration(job.started_at, job.finished_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openLogs(job)} title="Ver logs">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.status === 'running' && !job.cancel_requested && (
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => cancelJob.mutate(job.id)}
                          disabled={cancelJob.isPending}
                          title="Cancelar"
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {job.cancel_requested && job.status === 'running' && (
                        <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SyncHistoryLogsDrawer job={selectedJob} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}