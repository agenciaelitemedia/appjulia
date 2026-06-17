import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserSessions, useUserAuthEvents, type PerformancePeriod } from '../hooks/useTeamPerformance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  period: PerformancePeriod;
}

function fmtHMS(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}

function logoutLabel(t: string | null, open: boolean): { text: string; cls: string } | null {
  if (open) return { text: 'Em andamento', cls: 'border-emerald-500/40 text-emerald-700' };
  if (t === 'logout_manual') return { text: 'Logout manual', cls: 'border-zinc-400/40 text-zinc-600' };
  if (t === 'logout_inactivity') return { text: 'Inatividade', cls: 'border-amber-500/40 text-amber-700' };
  return null;
}

export function UserSessionsDialog({ open, onOpenChange, userId, userName, period }: Props) {
  const { data: sessions = [], isLoading } = useUserSessions(open ? userId : null, period);
  const { data: events = [], isLoading: loadingEvents } = useUserAuthEvents(open ? userId : null, period);

  const totalSec = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const closed = sessions.filter((s) => !s.open);
  const avgSec = closed.length > 0 ? Math.round(totalSec / Math.max(closed.length, 1)) : 0;

  const exportCsv = () => {
    const header = 'Login;Logout;Tempo online;Tipo\n';
    const lines = sessions.map((s) =>
      [
        fmtDateTime(s.login_at),
        fmtDateTime(s.logout_at),
        fmtHMS(s.duration_seconds),
        s.open ? 'Em aberto' : (s.logout_type || ''),
      ].join(';'),
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessoes_${userName.replace(/\s+/g, '_')}_${period.startDate}_${period.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div>
              <div>Sessões — {userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {period.startDate} → {period.endDate} · tempo medido por heartbeats reais (30s)
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={sessions.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">Sessões reais</TabsTrigger>
            <TabsTrigger value="auth">Eventos de auth</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-3">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <SummaryBox label="Sessões" value={sessions.length} />
          <SummaryBox label="Tempo online" value={fmtHMS(totalSec)} />
          <SummaryBox label="Média por sessão" value={fmtHMS(avgSec)} />
        </div>
        <div className="max-h-[55vh] overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhum heartbeat registrado no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Duração efetiva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s, i) => {
                  const lbl = logoutLabel(s.logout_type, s.open);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{fmtDateTime(s.login_at)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span>{fmtDateTime(s.logout_at)}</span>
                          {lbl && (
                            <Badge variant="outline" className={`text-[10px] ${lbl.cls}`}>{lbl.text}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtHMS(s.duration_seconds)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
          </TabsContent>

          <TabsContent value="auth" className="mt-3">
            <div className="max-h-[55vh] overflow-y-auto border rounded-md">
              {loadingEvents ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10">
                  Nenhum evento de login/logout no período
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/hora</TableHead>
                      <TableHead>Evento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{fmtDateTime(e.at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{e.type}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
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