import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUserCalls, type PerformancePeriod } from '../hooks/useTeamPerformance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  period: PerformancePeriod;
}

type CallFilter = 'all' | 'outbound' | 'answered' | 'missed';

function fmtHMS(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}

export function UserCallsDialog({ open, onOpenChange, userId, userName, period }: Props) {
  const { data: rows = [], isLoading } = useUserCalls(open ? userId : null, period);
  const [filter, setFilter] = useState<CallFilter>('all');

  useEffect(() => { if (open) setFilter('all'); }, [open]);

  const filteredRows = rows.filter((r) => {
    const isOut = (r.direction || '').toLowerCase() === 'outbound';
    const isAns = !!r.answered_at;
    switch (filter) {
      case 'outbound': return isOut;
      case 'answered': return isAns;
      case 'missed': return !isAns;
      default: return true;
    }
  });

  const total = rows.length;
  const outbound = rows.filter((r) => (r.direction || '').toLowerCase() === 'outbound').length;
  const answered = rows.filter((r) => !!r.answered_at).length;
  const missed = rows.filter((r) => !r.answered_at).length;
  const talkSec = rows.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);
  const uniqueNumbers = new Set(
    rows.map((r) => (r.called || r.caller || '').replace(/[^0-9]/g, '')).filter(Boolean),
  ).size;

  const exportCsv = () => {
    const header = 'Início;Direção;Número;Atendida;Duração;Causa\n';
    const lines = filteredRows.map((r) =>
      [
        fmtDateTime(r.started_at),
        r.direction || '',
        r.called || r.caller || '',
        r.answered_at ? 'sim' : 'não',
        fmtHMS(r.duration_seconds),
        r.hangup_cause || '',
      ].join(';'),
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ligacoes_${userName.replace(/\s+/g, '_')}_${period.startDate}_${period.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div>
              <div>Ligações — {userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {period.startDate} → {period.endDate} · chamadas dos ramais atribuídos
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 mb-2">
          <SummaryBox label="Total" value={total} active={filter === 'all'} onClick={() => setFilter('all')} />
          <SummaryBox label="EFETUADAS" value={outbound} active={filter === 'outbound'} onClick={() => setFilter('outbound')} />
          <SummaryBox label="Atendidas" value={answered} active={filter === 'answered'} onClick={() => setFilter('answered')} />
          <SummaryBox label="Perdidas" value={missed} active={filter === 'missed'} onClick={() => setFilter('missed')} />
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2">
          <SummaryBox label="Talk time" value={fmtHMS(talkSec)} />
          <SummaryBox label="Números únicos" value={uniqueNumbers} />
        </div>

        <div className="max-h-[55vh] overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhuma ligação no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const isOut = (r.direction || '').toLowerCase() === 'outbound';
                  const Icon = isOut ? PhoneOutgoing : PhoneIncoming;
                  const number = isOut ? r.called : r.caller;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{fmtDateTime(r.started_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${isOut ? 'border-blue-500/40 text-blue-700' : 'border-emerald-500/40 text-emerald-700'}`}>
                          <Icon className="h-3 w-3" />
                          {isOut ? 'Saída' : 'Entrada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{number || '—'}</TableCell>
                      <TableCell>
                        {r.answered_at ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">Atendida</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-zinc-400/40 text-zinc-600">Não atendida</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtHMS(r.duration_seconds)}</TableCell>
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
