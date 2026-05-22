import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCcw, MailX, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface DroppedRow {
  id: string;
  client_id: string | null;
  queue_id: string | null;
  queue_name: string | null;
  source: string;
  reason: string;
  event: string | null;
  chat_id: string | null;
  from_me: boolean | null;
  preview: string | null;
  raw_payload: unknown;
  created_at: string | null;
}

type PeriodKey = 'today' | '7d' | '30d' | 'all';

const PERIOD_SINCE: Record<PeriodKey, () => string | null> = {
  today: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); },
  '7d': () => new Date(Date.now() - 7 * 864e5).toISOString(),
  '30d': () => new Date(Date.now() - 30 * 864e5).toISOString(),
  all: () => null,
};

const REASON_LABELS: Record<string, string> = {
  no_phone: 'Sem telefone (broadcast/@lid/newsletter)',
  group_blocked: 'Grupo bloqueado',
  group_no_id: 'Grupo sem ID',
  no_id: 'Sem ID de mensagem',
  no_agent: 'Sem agente/fila (WABA)',
};

const REASON_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  no_phone: 'destructive',
  no_agent: 'destructive',
  group_blocked: 'secondary',
  group_no_id: 'secondary',
  no_id: 'outline',
};

export function DroppedMessagesTab() {
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const [reason, setReason] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [payloadRow, setPayloadRow] = useState<DroppedRow | null>(null);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dropped-messages', period],
    queryFn: async () => {
      let q = supabase
        .from('chat_dropped_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      const since = PERIOD_SINCE[period]();
      if (since) q = q.gte('created_at', since);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DroppedRow[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (reason !== 'all' && r.reason !== reason) return false;
      if (term) {
        const hay = `${r.chat_id ?? ''} ${r.preview ?? ''} ${r.queue_name ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, reason, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MailX className="w-5 h-5" /> Mensagens descartadas
        </h2>
        <p className="text-sm text-muted-foreground">
          Mensagens recebidas que NÃO entraram no chat (propaganda, broadcast, newsletter, @lid, grupos bloqueados, etc.).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Período</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo (até 300)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Motivo</span>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              {Object.entries(REASON_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Buscar (ID/prévia/fila)</span>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex.: 5562981102079" />
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border rounded-md">
          Nenhuma mensagem descartada no período.
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/hora</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Chat ID / Remetente</TableHead>
                <TableHead>Prévia</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm:ss') : '—'}
                  </TableCell>
                  <TableCell className="text-xs uppercase">{r.source}</TableCell>
                  <TableCell>
                    <Badge variant={REASON_VARIANT[r.reason] ?? 'outline'} className="text-[10px]">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all max-w-[200px]">{r.chat_id || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={r.preview ?? ''}>
                    {r.preview || <span className="text-muted-foreground">(sem texto)</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setPayloadRow(r)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!payloadRow} onOpenChange={(o) => { if (!o) setPayloadRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload bruto — {payloadRow?.chat_id || payloadRow?.id}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-[60vh]">
            {payloadRow ? JSON.stringify(payloadRow.raw_payload, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
