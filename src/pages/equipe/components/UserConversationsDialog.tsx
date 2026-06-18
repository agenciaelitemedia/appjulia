import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserConversations, type PerformancePeriod } from '../hooks/useTeamPerformance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  period: PerformancePeriod;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}

function statusBadge(status: string | null, closeReason: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') {
    return { text: closeReason || 'Resolvida', cls: 'border-emerald-500/40 text-emerald-700' };
  }
  if (s === 'pending') return { text: 'Pendente', cls: 'border-amber-500/40 text-amber-700' };
  if (s === 'open') return { text: 'Aberta', cls: 'border-blue-500/40 text-blue-700' };
  return { text: status || '—', cls: 'border-zinc-400/40 text-zinc-600' };
}

export function UserConversationsDialog({ open, onOpenChange, userId, userName, period }: Props) {
  const { data: rows = [], isLoading } = useUserConversations(open ? userId : null, open ? userName : null, period);

  const total = rows.length;
  const resolved = rows.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'resolved' || s === 'closed';
  }).length;
  const open_ = rows.filter((r) => (r.status || '').toLowerCase() === 'open').length;
  const pending = rows.filter((r) => (r.status || '').toLowerCase() === 'pending').length;

  const exportCsv = () => {
    const header = 'Contato;Telefone;Início;Última msg cliente;Status;Motivo\n';
    const lines = rows.map((r) =>
      [
        r.contact_name || '',
        r.phone || '',
        fmtDateTime(r.opened_at),
        fmtDateTime(r.last_customer_message_at),
        r.status || '',
        r.close_reason || '',
      ].join(';'),
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atendimentos_${userName.replace(/\s+/g, '_')}_${period.startDate}_${period.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div>
              <div>Atendimentos — {userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {period.startDate} → {period.endDate} · 1 linha por atribuição (mesma conversa pode aparecer mais de uma vez)
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 mb-2">
          <SummaryBox label="Total" value={total} />
          <SummaryBox label="Resolvidas" value={resolved} />
          <SummaryBox label="Abertas" value={open_} />
          <SummaryBox label="Pendentes" value={pending} />
        </div>
        <div className="max-h-[55vh] overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhum atendimento atribuído no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Atribuído em</TableHead>
                  <TableHead>Última msg</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const lbl = statusBadge(r.status, r.close_reason);
                  return (
                    <TableRow key={r.event_key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{r.contact_name || '—'}</span>
                          {r.phone && <span className="font-mono text-xs text-muted-foreground">{r.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{fmtDateTime(r.assigned_at)}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtDateTime(r.last_customer_message_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${lbl.cls}`}>{lbl.text}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}