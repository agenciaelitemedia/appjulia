import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, Plus, RefreshCw, Plug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWavoip } from '@/contexts/WavoipContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

type Device = { id: string; device_token: string; device_name: string | null; friendly_code: string | null; whatsapp_number: string | null; status: string; connection_status: string; whatsapp_jids: any; user_id: string | null; created_at: string };
type CallLog = { id: string; created_at: string; direction: string; status: string; from_number: string | null; to_number: string | null; duration_seconds: number };

export default function WavoipPage() {
  const { hasActivePlan, ready, openWidget, refreshDevices, canDial } = useWavoip();
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const clientId = user?.client_id ?? null;
  const [devices, setDevices] = useState<Device[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [devRes, callRes] = await Promise.all([
      (supabase as any).from('wavoip_devices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      (supabase as any).from('wavoip_call_logs').select('id,created_at,direction,status,from_number,to_number,duration_seconds').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
    ]);
    setLoading(false);
    if (devRes.error) { toast.error(devRes.error.message); return; }
    setDevices((devRes.data ?? []) as Device[]);
    setCalls((callRes.data ?? []) as CallLog[]);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [clientId]);

  const handleClaim = async () => {
    if (!clientId || !userId) { toast.error('Sessão inválida'); return; }
    if (!newName.trim()) { toast.error('Informe um nome'); return; }
    setBusy(true);
    try {
      // Pega um dispositivo do client_id ainda não atribuído a um usuário do escritório
      const { data: candidates, error: qErr } = await (supabase as any)
        .from('wavoip_devices')
        .select('id')
        .eq('client_id', clientId)
        .is('user_id', null)
        .order('created_at', { ascending: true })
        .limit(1);
      if (qErr) throw qErr;
      const device = candidates?.[0];
      if (!device) { toast.error('Nenhum dispositivo disponível no seu plano. Solicite mais dispositivos ao administrador.'); return; }

      const { error: updErr } = await (supabase as any)
        .from('wavoip_devices')
        .update({ user_id: userId, device_name: newName.trim() })
        .eq('id', device.id);
      if (updErr) throw updErr;

      toast.success('Dispositivo adicionado — conectando...');
      setDialogOpen(false);
      setNewName('');

      // Conecta
      setConnectingId(device.id);
      const { error: fnErr } = await (supabase as any).functions.invoke('wavoip-connect-device', { body: { device_id: device.id } });
      setConnectingId(null);
      if (fnErr) toast.error(fnErr.message || 'Falha ao conectar dispositivo');
      else toast.success('Dispositivo conectado');

      await load();
      await refreshDevices();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adicionar');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    const { data, error } = await (supabase as any).functions.invoke('wavoip-connect-device', { body: { device_id: id } });
    setConnectingId(null);
    if (error) {
      const msg = (error as any)?.context?.body || error.message || 'Falha ao conectar';
      toast.error(typeof msg === 'string' ? msg : 'Falha ao conectar dispositivo');
      return;
    }
    if (data && data.ok === false) {
      toast.error(`Não foi possível conectar: ${data.error ?? 'erro desconhecido'}`);
    } else {
      toast.success('Conexão atualizada');
    }
    await load();
    await refreshDevices();
  };

  const handleRelease = async (id: string) => {
    if (!confirm('Liberar este dispositivo (devolve para o pool do escritório)?')) return;
    const { error } = await (supabase as any).from('wavoip_devices').update({ user_id: null, connection_status: 'disconnected', connected_at: null, whatsapp_jids: [] }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Dispositivo liberado');
    await load();
    await refreshDevices();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Wavoip</h1>
            <p className="text-sm text-muted-foreground">Chamadas de voz WhatsApp via Wavoip</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={hasActivePlan ? 'default' : 'secondary'}>
            {hasActivePlan ? 'Plano ativo' : 'Sem plano'}
          </Badge>
          {ready && <Badge variant="outline">Webphone pronto</Badge>}
          <Button variant="outline" onClick={openWidget} disabled={!canDial} title={!canDial ? 'Conecte um dispositivo para liberar o discador' : 'Abrir discador'}>
            Abrir discador
          </Button>
        </div>
      </div>

      {!hasActivePlan && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Você ainda não possui um plano Wavoip ativo. Solicite a ativação ao administrador.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Meus dispositivos</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!hasActivePlan}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar dispositivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dispositivo cadastrado.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {devices.map((d) => {
                const jids: string[] = Array.isArray(d.whatsapp_jids) ? d.whatsapp_jids : [];
                const mine = d.user_id === userId;
                return (
                  <div key={d.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{d.device_name || `WAPhone_${d.friendly_code ?? ''}`}</div>
                      <div className="text-xs text-muted-foreground">
                        Token: <span className="font-mono">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</span>
                        {jids.length > 0 && <> · Números: {jids.join(', ')}</>}
                        {!mine && d.user_id && <> · em uso por outro membro</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.connection_status === 'connected' ? 'default' : 'outline'}>
                        {d.connection_status}
                      </Badge>
                      {mine && (
                        <Button variant="outline" size="sm" onClick={() => handleConnect(d.id)} disabled={connectingId === d.id}>
                          <Plug className="h-4 w-4 mr-1" /> {connectingId === d.id ? 'Conectando…' : 'Reconectar'}
                        </Button>
                      )}
                      {mine && (
                        <Button variant="ghost" size="sm" onClick={() => handleRelease(d.id)}>
                          Liberar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Minhas chamadas</CardTitle></CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma chamada registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{format(new Date(c.created_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell><Badge variant="outline">{c.direction}</Badge></TableCell>
                    <TableCell>{c.from_number ?? '-'}</TableCell>
                    <TableCell>{c.to_number ?? '-'}</TableCell>
                    <TableCell>{Math.floor((c.duration_seconds || 0) / 60)}m {(c.duration_seconds || 0) % 60}s</TableCell>
                    <TableCell><Badge variant={c.status === 'answered' ? 'default' : 'outline'}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar dispositivo Wavoip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do dispositivo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Atendimento 01" />
              <p className="text-xs text-muted-foreground mt-1">Um dispositivo disponível do seu plano será reservado e conectado automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleClaim} disabled={busy || !newName.trim()}>
              {busy ? 'Adicionando…' : 'Adicionar e conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}