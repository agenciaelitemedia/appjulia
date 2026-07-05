import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWavoipCallHistory, type WavoipCall } from '../hooks/useWavoipCallHistory';
import { RecordingPlayer } from './RecordingPlayer';

function formatBRPhone(raw?: string | null): string {
  if (!raw) return '-';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '-';
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

function durationLabel(s: number) {
  const sec = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function statusInfo(c: WavoipCall): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
  const s = (c.status || '').toLowerCase();
  if (s === 'ended') return { label: 'ENCERRADA', variant: 'default' };
  if (s === 'cancelled' || s === 'canceled') return { label: 'CANCELADA', variant: 'secondary' };
  if (s === 'rejected') return { label: 'REJEITADA', variant: 'secondary' };
  if (s === 'not_answered' || s === 'no_answer') return { label: 'NÃO ATENDIDA', variant: 'secondary' };
  if (s === 'missed') return { label: 'PERDIDA', variant: 'secondary' };
  if (s === 'failed' || s === 'error' || s === 'connection_lost') return { label: 'FALHOU', variant: 'destructive' };
  if (s === 'handled_remotely') return { label: 'ATENDIDA EM OUTRO DISPOSITIVO', variant: 'outline' };
  if (s === 'active') return { label: 'EM CURSO', variant: 'outline' };
  if (['calling', 'ringing', 'incoming_ring', 'outgoing_ring', 'outgoing_calling', 'connecting'].includes(s)) return { label: 'CHAMANDO', variant: 'outline' };
  return { label: (c.status || '-').toUpperCase(), variant: 'outline' };
}

export function CallHistoryTab() {
  const { user } = useAuth();
  const clientId = user?.client_id ?? null;
  const appUserId = user?.id ? Number(user.id) : null;
  const isAdmin = Boolean((user as any)?.is_admin);
  const [ownOnly, setOwnOnly] = useState(!isAdmin);
  const { data: calls = [], isLoading, refetch } = useWavoipCallHistory(clientId, appUserId, { ownOnly });
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    if (!clientId) return;
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('wavoip-sync-history', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      toast.success('Histórico sincronizado com a Wavoip');
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao sincronizar');
    } finally { setSyncing(false); }
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [causeFilter, setCauseFilter] = useState<'all' | 'answered' | 'missed' | 'failed'>('all');

  const filtered = useMemo(() => {
    const term = search.replace(/\D/g, '');
    return calls.filter((c) => {
      if (typeFilter !== 'all' && c.direction !== typeFilter) return false;
      const si = statusInfo(c).label;
      if (causeFilter === 'answered' && si !== 'ENCERRADA') return false;
      if (causeFilter === 'missed' && !['NÃO ATENDIDA', 'CANCELADA', 'REJEITADA', 'PERDIDA'].includes(si)) return false;
      if (causeFilter === 'failed' && si !== 'FALHOU') return false;
      if (term) {
        const blob = `${c.to_number ?? ''} ${c.from_number ?? ''}`.replace(/\D/g, '');
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  }, [calls, search, typeFilter, causeFilter]);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Histórico de Chamadas</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filtered.length} de {calls.length} registro(s)</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button variant="default" size="sm" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar com Wavoip
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-56" placeholder="Buscar número…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="outbound">Saída</SelectItem>
              <SelectItem value="inbound">Entrada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={causeFilter} onValueChange={(v) => setCauseFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as causas</SelectItem>
              <SelectItem value="answered">Atendidas</SelectItem>
              <SelectItem value="missed">Perdidas / Canceladas</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant={ownOnly ? 'outline' : 'default'} size="sm" onClick={() => setOwnOnly((v) => !v)}>
              {ownOnly ? 'Mostrar todos do escritório' : 'Somente minhas'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma chamada encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Número discado</TableHead>
                <TableHead>Iniciou às</TableHead>
                <TableHead>Finalizou às</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Causa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-16 text-center">Gravação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const si = statusInfo(c);
                const numero = c.direction === 'inbound' ? c.from_number : c.to_number;
                const started = c.started_at ?? c.created_at;
                const ended = c.ended_at;
                return (
                  <TableRow key={c.id}>
                    <TableCell><Badge variant="outline">Wavoip</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{formatBRPhone(numero)}</TableCell>
                    <TableCell className="text-xs">{started ? format(new Date(started), 'dd/MM/yyyy, HH:mm:ss') : '-'}</TableCell>
                    <TableCell className="text-xs">{ended ? format(new Date(ended), 'dd/MM/yyyy, HH:mm:ss') : '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{durationLabel(c.duration_seconds)}</TableCell>
                    <TableCell><Badge variant={si.variant}>{si.label}</Badge></TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs">
                        {c.direction === 'inbound'
                          ? <PhoneIncoming className="h-3 w-3 text-blue-600" />
                          : <PhoneOutgoing className="h-3 w-3 text-emerald-600" />}
                        {c.direction === 'inbound' ? 'Entrada' : 'Saída'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <RecordingPlayer
                        callId={c.id}
                        whatsappCallId={c.whatsapp_call_id}
                        recordingPath={c.recording_url}
                        status={c.recording_status}
                        durationSeconds={c.duration_seconds}
                        onRefetched={refetch}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}