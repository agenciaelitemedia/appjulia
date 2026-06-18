import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUserOutcomes, type PerformancePeriod, type OutcomeKind } from '../hooks/useTeamPerformance';

type FilterKind = 'all' | OutcomeKind;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  period: PerformancePeriod;
  initialFilter?: FilterKind;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}

const KIND_META: Record<OutcomeKind, { label: string; cls: string }> = {
  resolved: { label: 'Resolvida', cls: 'border-emerald-500/40 text-emerald-700' },
  returned: { label: 'Devolvida', cls: 'border-amber-500/40 text-amber-700' },
  transferred: { label: 'Transferida', cls: 'border-blue-500/40 text-blue-700' },
};

export function UserOutcomesDialog({ open, onOpenChange, userId, userName, period, initialFilter = 'all' }: Props) {
  const { data: rows = [], isLoading } = useUserOutcomes(open ? userId : null, open ? userName : null, period);
  const [filter, setFilter] = useState<FilterKind>(initialFilter);

  useEffect(() => { if (open) setFilter(initialFilter); }, [open, initialFilter]);

  const filteredRows = rows.filter((r) => filter === 'all' ? true : r.kind === filter);

  const total = rows.length;
  const resolved = rows.filter((r) => r.kind === 'resolved').length;
  const returned = rows.filter((r) => r.kind === 'returned').length;
  const transferred = rows.filter((r) => r.kind === 'transferred').length;

  const exportCsv = () => {
    const header = 'Contato;Telefone;Quando;Desfecho;Motivo;Para\n';
    const lines = filteredRows.map((r) =>
      [
        r.contact_name || '',
        r.phone || '',
        fmtDateTime(r.at),
        KIND_META[r.kind].label,
        r.close_reason || '',
        r.kind === 'transferred' ? (r.to_value || '') : '',
      ].join(';'),
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `desfechos_${userName.replace(/\s+/g, '_')}_${period.startDate}_${period.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div>
              <div>Desfechos — {userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {period.startDate} → {period.endDate} · 1 linha por evento de desfecho
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 mb-2">
          <SummaryBox label="Total" value={total} active={filter === 'all'} onClick={() => setFilter('all')} />
          <SummaryBox label="Resolvidas" value={resolved} active={filter === 'resolved'} onClick={() => setFilter('resolved')} />
          <SummaryBox label="Devolvidas" value={returned} active={filter === 'returned'} onClick={() => setFilter('returned')} />
          <SummaryBox label="Transferidas" value={transferred} active={filter === 'transferred'} onClick={() => setFilter('transferred')} />
        </div>
        <div className="max-h-[55vh] overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhum desfecho encontrado no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Desfecho</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const meta = KIND_META[r.kind];
                  const detail = r.kind === 'transferred'
                    ? (r.to_value ? `→ ${r.to_value}` : '—')
                    : (r.close_reason || '—');
                  return (
                    <TableRow key={r.event_key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{r.contact_name || '—'}</span>
                          {r.phone && <span className="font-mono text-xs text-muted-foreground">{r.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{fmtDateTime(r.at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{detail}</TableCell>
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

function SummaryBox({ label, value, active, onClick }: { label: string; value: string | number; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md border bg-muted/20 px-3 py-2 transition-colors',
        active && 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800',
        onClick && 'cursor-pointer hover:bg-muted/40',
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </button>
  );
}