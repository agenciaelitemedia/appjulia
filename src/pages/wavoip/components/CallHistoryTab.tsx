import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, PhoneIncoming, PhoneOutgoing, Smartphone, User } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWavoipCallHistory, type WavoipCall } from '../hooks/useWavoipCallHistory';
import { useWavoipReconcileQueue } from '../hooks/useWavoipReconcileQueue';
import { useWavoipClientPlanFeatures } from '../hooks/useWavoipClientPlanFeatures';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { RecordingPlayer } from './RecordingPlayer';
import { TranscriptionButton } from './TranscriptionButton';

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
  const { hasPending, count, nextRunAt } = useWavoipReconcileQueue(clientId);
  const { data: planFeatures } = useWavoipClientPlanFeatures(clientId);
  const planAllowsTranscription = !!planFeatures?.transcription;
  const [processing, setProcessing] = useState(false);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const { data: team = [] } = useTeamByClient();
  const userNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of team) map[Number(m.id)] = m.name;
    return map;
  }, [team]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('wavoip_devices')
        .select('id, device_name, device_token')
        .eq('client_id', clientId);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const d of data) {
        map[d.id] = d.device_name || (d.device_token ? `Dispositivo ••${String(d.device_token).slice(-6)}` : 'Dispositivo');
      }
      setDeviceNames(map);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  // Auto-dispatch transcription for pending rows that already have a recording.
  // Covers backfill: rows whose recording became available before the auto-dispatch
  // hook was added to wavoip-fetch-recording.
  const [autoDispatched] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!planAllowsTranscription) return;
    const pending = calls.filter(
      (c) =>
        c.recording_status === 'available' &&
        (c.transcription_status ?? 'pending') === 'pending' &&
        !autoDispatched.has(c.id),
    );
    if (pending.length === 0) return;
    for (const c of pending) {
      autoDispatched.add(c.id);
      supabase.functions
        .invoke('wavoip-transcribe-recording', { body: { call_id: c.id } })
        .catch(() => { /* ignore; UI will show failed state on next refresh */ });
    }
  }, [calls, planAllowsTranscription, autoDispatched]);

  const processQueue = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('wavoip-reconcile-runner', {
        body: { client_id: clientId, force: true },
      });
      if (error) throw error;
      toast.success('Fila de atualização processada');
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao processar fila');
    } finally { setProcessing(false); }
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
            {hasPending && (
              <Button
                variant="default"
                size="sm"
                onClick={processQueue}
                disabled={processing || isLoading}
                title="Processa agora as chamadas pendentes na fila (normalmente atualizadas 1 min após o término)"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${processing ? 'animate-spin' : ''}`} /> Processar fila pendente ({count})
              </Button>
            )}
            {nextRunAt && (
              <span className="text-xs text-muted-foreground">
                Próxima execução: {format(nextRunAt, 'HH:mm')}
              </span>
            )}
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
                <TableHead>Dispositivo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Número discado</TableHead>
                <TableHead>Iniciou às</TableHead>
                <TableHead>Finalizou às</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-16 text-center">Gravação</TableHead>
                <TableHead className="w-16 text-center">Transcrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const si = statusInfo(c);
                const numero = c.direction === 'inbound' ? c.from_number : c.to_number;
                const started = c.started_at ?? c.created_at;
                const ended = c.ended_at;
                const deviceLabel = c.device_id ? (deviceNames[c.device_id] ?? 'Dispositivo') : '-';
                return (
                  <TableRow key={c.id}>
                    <TableCell><Badge variant="outline">Wavoip</Badge></TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="h-3 w-3 text-muted-foreground" />
                        {deviceLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {c.app_user_id != null ? (userNames[Number(c.app_user_id)] ?? `#${c.app_user_id}`) : '—'}
                      </span>
                    </TableCell>
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
                    <TableCell className="text-center">
                      <TranscriptionButton
                        call={c}
                        planAllowsTranscription={planAllowsTranscription}
                        onRefetch={refetch}
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