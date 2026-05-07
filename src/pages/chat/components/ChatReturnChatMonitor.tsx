import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw, PlayCircle, CheckCircle2, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface HistoryRow {
  id: string;
  conversation_id: string;
  action: string;
  actor_name: string | null;
  from_value: string | null;
  to_value: string | null;
  notes: string | null;
  created_at: string;
}

interface RunResult {
  processed: number;
  results: Array<{ id: string; ok: boolean; error?: string }>;
  ranAt: string;
}

export function ChatReturnChatMonitor() {
  const { user } = useAuth();
  const clientId = String(user?.client_id ?? '');
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['return-chat-history', clientId],
    enabled: !!clientId,
    refetchInterval: 30_000,
    queryFn: async () => {
      // Get conversations for this client first
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('client_id', clientId);
      const ids = (convs ?? []).map((c: any) => c.id);
      if (ids.length === 0) return [] as HistoryRow[];

      const { data, error } = await supabase
        .from('chat_conversation_history')
        .select('*')
        .eq('action', 'auto_returned')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const now = Date.now();
  const last24h = rows.filter(r => now - new Date(r.created_at).getTime() < 86_400_000).length;
  const last7d = rows.filter(r => now - new Date(r.created_at).getTime() < 7 * 86_400_000).length;
  const lastEntry = rows[0];

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-return-chat', { body: {} });
      if (error) throw error;
      const result: RunResult = {
        processed: data?.processed ?? 0,
        results: data?.results ?? [],
        ranAt: new Date().toISOString(),
      };
      setLastRun(result);
      const errors = result.results.filter(r => !r.ok).length;
      if (errors > 0) {
        toast.warning(`Processadas ${result.processed}, ${errors} com erro`);
      } else {
        toast.success(`Execução concluída — ${result.processed} processada(s)`);
      }
      qc.invalidateQueries({ queryKey: ['return-chat-history', clientId] });
    } catch (err: any) {
      toast.error(`Falha ao executar: ${err?.message ?? err}`);
      setLastRun({ processed: 0, results: [{ id: '-', ok: false, error: String(err?.message ?? err) }], ranAt: new Date().toISOString() });
    } finally {
      setRunning(false);
    }
  };

  const errorRows = lastRun?.results.filter(r => !r.ok) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Monitor — Retornar Chat
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe a execução automática do worker que devolve conversas à fila Em Aberto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleRunNow} disabled={running}>
            <PlayCircle className={`h-3.5 w-3.5 mr-1.5 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Executando…' : 'Executar agora'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Última devolução"
          value={lastEntry ? formatDistanceToNow(new Date(lastEntry.created_at), { locale: ptBR, addSuffix: true }) : '—'}
          hint={lastEntry ? format(new Date(lastEntry.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : 'Nenhuma execução registrada'}
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Últimas 24h"
          value={String(last24h)}
          hint="Conversas devolvidas à fila"
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Últimos 7 dias"
          value={String(last7d)}
          hint="Conversas devolvidas à fila"
        />
      </div>

      {/* Cron info */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle className="text-sm">Agendamento</AlertTitle>
        <AlertDescription className="text-xs">
          O worker <code className="font-mono text-[11px] bg-muted px-1 rounded">chat-return-chat</code> roda automaticamente a cada minuto via cron.
          Use “Executar agora” para forçar uma rodada manual e ver imediatamente o resultado.
        </AlertDescription>
      </Alert>

      {/* Last manual run */}
      {lastRun && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {errorRows.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              Última execução manual
            </CardTitle>
            <CardDescription className="text-xs">
              {format(new Date(lastRun.ranAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} — {lastRun.processed} processada(s), {errorRows.length} erro(s)
            </CardDescription>
          </CardHeader>
          {errorRows.length > 0 && (
            <CardContent className="space-y-2">
              {errorRows.map((r, i) => (
                <div key={i} className="text-xs rounded border border-destructive/40 bg-destructive/5 p-2">
                  <div className="font-mono text-[11px] text-muted-foreground">conversa: {r.id}</div>
                  <div className="text-destructive">{r.error}</div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* History table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Histórico de devoluções automáticas</CardTitle>
          <CardDescription className="text-xs">
            Últimas 50 conversas devolvidas pelo worker (registros em <code className="font-mono text-[11px]">chat_conversation_history</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
              Nenhuma devolução automática registrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Quando</TableHead>
                  <TableHead>Responsável removido</TableHead>
                  <TableHead className="w-[110px]">Novo status</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">
                      <div>{format(new Date(row.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(row.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.from_value ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{row.to_value ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold mt-1.5 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}