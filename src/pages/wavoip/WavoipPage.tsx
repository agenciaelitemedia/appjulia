import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PhoneCall, Plus, RefreshCw, Plug, QrCode, CheckCircle2, AlertTriangle, Smartphone, ShieldCheck, ShieldAlert, Copy, Users2, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useWavoip } from '@/contexts/WavoipContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CallHistoryTab } from './components/CallHistoryTab';
import { ShareDeviceDialog } from './components/ShareDeviceDialog';
import { ConfirmDeleteDialog } from '@/pages/admin/wavoip/components/ConfirmDeleteDialog';
import {
  useClientDeviceQueueLinks,
  useClientQueuesForLink,
  useSetDeviceQueues,
} from './hooks/useWavoipDeviceQueues';
import { Checkbox } from '@/components/ui/checkbox';

type Device = {
  id: string;
  client_id: number | null;
  device_token: string;
  device_name: string | null;
  friendly_code: string | null;
  whatsapp_number: string | null;
  whatsapp_jid: string | null;
  status: string;
  connection_status: string;
  whatsapp_jids: any;
  user_id: string | null;
  app_user_id?: number | null;
  created_at: string;
  metadata?: any;
  webhook_status?: string | null;
  webhook_url?: string | null;
  webhook_checked_at?: string | null;
  webhook_last_error?: string | null;
};
type CallLog = { id: string; created_at: string; direction: string; status: string; from_number: string | null; to_number: string | null; duration_seconds: number };
type ConnectStatus = 'idle' | 'preparing' | 'waiting_qr' | 'open' | 'error';

const QR_TIMEOUT_SECONDS = 180;

const normalizePhone = (phone?: string | null) => (phone || '').replace(/\D/g, '');
const jidFromPhone = (phone?: string | null) => {
  const digits = normalizePhone(phone);
  return digits ? `${digits}@s.whatsapp.net` : null;
};
const phoneFromJid = (jid?: string | null) => normalizePhone(String(jid || '').split('@')[0]);
const extractSnapshotJid = (snapshot?: any) => {
  const raw = snapshot?.jid ?? snapshot?.whatsapp_jid ?? snapshot?.whatsappJid ?? snapshot?.contact?.jid ?? snapshot?.contact?.id ?? snapshot?.me?.jid ?? snapshot?.me?.id ?? null;
  return raw ? String(raw) : null;
};
const extractSnapshotPhone = (snapshot?: any) => {
  const raw = snapshot?.contact?.phone ?? snapshot?.phone ?? snapshot?.number ?? snapshot?.whatsapp_number ?? snapshot?.whatsappNumber ?? snapshot?.me?.phone ?? null;
  return normalizePhone(raw) || phoneFromJid(extractSnapshotJid(snapshot)) || null;
};

const qrImageUrl = (token: string) => `https://devices.wavoip.com/${encodeURIComponent(token)}/whatsapp/qr-image?ts=${Date.now()}`;

export default function WavoipPage() {
  const { hasActivePlan, ready, openWidget, refreshDevices, canDial, ensureWebphone, liveDeviceStatuses } = useWavoip();
  const { user } = useAuth();
  const appUserId = user?.id ? Number(user.id) : null;
  const clientId = user?.client_id ?? null;
  const [devices, setDevices] = useState<Device[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  const [membersByDevice, setMembersByDevice] = useState<Record<string, number>>({});
  const [shareTarget, setShareTarget] = useState<Device | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Device | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Device | null>(null);
  const [renameTarget, setRenameTarget] = useState<Device | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameQueueIds, setRenameQueueIds] = useState<string[]>([]);
  const [newDeviceQueueIds, setNewDeviceQueueIds] = useState<string[]>([]);
  const { data: allQueuesForClient = [] } = useClientQueuesForLink(clientId);
  const { data: deviceQueueLinks = {} } = useClientDeviceQueueLinks(clientId);
  const setDeviceQueuesMut = useSetDeviceQueues();
  // Mapa deviceId -> queueId[] (derivado do inverso de deviceQueueLinks)
  const queuesByDevice = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const [qid, devIds] of Object.entries(deviceQueueLinks)) {
      for (const d of devIds) (m[d] ||= []).push(qid);
    }
    return m;
  }, [deviceQueueLinks]);
  const queueNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const q of allQueuesForClient) m[q.id] = q.name;
    return m;
  }, [allQueuesForClient]);
  const [actionBusy, setActionBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectingDevice, setConnectingDevice] = useState<Device | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('idle');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QR_TIMEOUT_SECONDS);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sdkSnapshot, setSdkSnapshot] = useState<any | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const intervalRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const sharedSet = useMemo(() => new Set(sharedIds), [sharedIds]);
  const myDevices = useMemo(
    () => devices.filter((d) => Number(d.app_user_id) === appUserId || sharedSet.has(d.id)),
    [devices, appUserId, sharedSet]
  );

  const slotStats = useMemo(() => {
    const total = devices.length;
    const used = devices.filter((d) => d.app_user_id != null).length;
    return { total, used, remaining: Math.max(0, total - used) };
  }, [devices]);
  const limitReached = slotStats.total > 0 && slotStats.remaining <= 0;
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [devRes, callRes, sharedRes] = await Promise.all([
      (supabase as any).from('wavoip_devices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      (supabase as any).from('wavoip_call_logs').select('id,created_at,direction,status,from_number,to_number,duration_seconds').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
      appUserId
        ? (supabase as any).from('wavoip_device_members').select('device_id').eq('app_user_id', appUserId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setLoading(false);
    if (devRes.error) { toast.error(devRes.error.message); return; }
    const devs = (devRes.data ?? []) as Device[];
    setDevices(devs);
    setCalls((callRes.data ?? []) as CallLog[]);
    setSharedIds(((sharedRes as any).data ?? []).map((r: any) => r.device_id));

    // Contagem de membros compartilhados por dispositivo (do usuário logado como dono).
    const ownedIds = devs.filter((d) => Number(d.app_user_id) === appUserId).map((d) => d.id);
    if (ownedIds.length > 0) {
      const { data: memberRows } = await (supabase as any)
        .from('wavoip_device_members')
        .select('device_id')
        .in('device_id', ownedIds);
      const counts: Record<string, number> = {};
      ((memberRows ?? []) as { device_id: string }[]).forEach((r) => {
        counts[r.device_id] = (counts[r.device_id] || 0) + 1;
      });
      setMembersByDevice(counts);
    } else {
      setMembersByDevice({});
    }
  }, [clientId, appUserId]);

  useEffect(() => { void load(); }, [load]);

  const resetConnectionState = useCallback(() => {
    cleanupRef.current.forEach((fn) => {
      try { fn(); } catch {}
    });
    cleanupRef.current = [];
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    completedRef.current = false;
    setConnectStatus('idle');
    setQrUrl(null);
    setQrText(null);
    setCountdown(QR_TIMEOUT_SECONDS);
    setConnectError(null);
    setSdkSnapshot(null);
  }, []);

  useEffect(() => () => resetConnectionState(), [resetConnectionState]);

  const syncDeviceAsConnected = useCallback(async (device: Device, contactPhone?: string | null, snapshot?: any) => {
    const snapshotJid = extractSnapshotJid(snapshot);
    const phone = normalizePhone(contactPhone || extractSnapshotPhone(snapshot) || device.whatsapp_number);
    const jid = snapshotJid || jidFromPhone(phone) || device.whatsapp_jid || (Array.isArray(device.whatsapp_jids) ? device.whatsapp_jids[0] : null);
    const jids = jid ? [jid] : [];
    const metadata = {
      ...(device.metadata ?? {}),
      last_connect: {
        type: 'sdk',
        status: snapshot?.status ?? 'open',
        connectionStatus: snapshot?.connectionStatus ?? null,
        contact: snapshot?.contact ?? (phone ? { phone } : null),
        synced_at: new Date().toISOString(),
      },
      last_error: null,
    };
    const { error } = await (supabase as any).from('wavoip_devices').update({
      connection_status: 'connected',
      connected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      whatsapp_number: phone || null,
      whatsapp_jid: jid,
      whatsapp_jids: jids,
      metadata,
    }).eq('id', device.id);
    if (error) throw error;
  }, []);

  const markDeviceStatus = useCallback(async (deviceId: string, status: 'connecting' | 'disconnected' | 'error', extra?: Record<string, any>) => {
    const payload: Record<string, any> = {
      connection_status: status,
      last_seen_at: new Date().toISOString(),
      ...(extra ?? {}),
    };
    if (status !== 'connecting') payload.connected_at = null;
    await (supabase as any).from('wavoip_devices').update(payload).eq('id', deviceId);
  }, []);

  const startConnectFlow = useCallback(async (device: Device) => {
    resetConnectionState();
    setConnectingDevice(device);
    setConnectStatus('preparing');
    setQrUrl(qrImageUrl(device.device_token));
    setConnectError(null);

    try {
      if (!device.app_user_id && appUserId) {
        await (supabase as any).from('wavoip_devices').update({ app_user_id: appUserId }).eq('id', device.id);
      }
      const { data: prepared, error: prepareErr } = await supabase.functions.invoke('wavoip-connect-device', {
        body: { device_id: device.id },
      });
      if (prepareErr) throw prepareErr;
      if ((prepared as any)?.qr_url) setQrUrl(`${(prepared as any).qr_url}?ts=${Date.now()}`);

      const wp: any = await ensureWebphone();
      if (!wp?.device) throw new Error('Webphone ZAP Call não inicializado');

      try { wp.device.add(device.device_token, true); } catch {}
      try { wp.device.enable(device.device_token); } catch {}
      try { openWidget(); } catch {}

      const finishSuccess = async (snapshot?: any, contactPhone?: string | null) => {
        if (completedRef.current) return;
        completedRef.current = true;
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        try {
          await syncDeviceAsConnected(device, contactPhone, snapshot);
          setSdkSnapshot(snapshot ?? null);
          setConnectStatus('open');
          setQrText(null);
          setQrUrl(null);
          toast.success('Dispositivo conectado. Discador liberado.');
          await load();
          await refreshDevices();
        } catch (e: any) {
          completedRef.current = false;
          setConnectStatus('error');
          setConnectError(e?.message || 'Conectou na ZAP Call, mas falhou ao salvar os dados');
        }
      };

      const inspect = async () => {
        const entries = wp.device.get?.() ?? [];
        const entry = entries.find((x: any) => x?.token === device.device_token);
        if (!entry) return;
        const status = String(entry.status ?? '').toLowerCase();
        setSdkSnapshot(entry);
        if (entry.qrCode) setQrText(String(entry.qrCode));
        if (status === 'open') {
          await finishSuccess(entry, extractSnapshotPhone(entry));
          return;
        }
        if (status === 'error' || status === 'waiting_payment' || status === 'external_integration_error') {
          completedRef.current = true;
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          setConnectStatus('error');
          setConnectError(`ZAP Call retornou status ${entry.status}`);
          await markDeviceStatus(device.id, 'error', { metadata: { ...(device.metadata ?? {}), last_error: entry.status, last_connect: entry } });
          return;
        }
        setConnectStatus('waiting_qr');
      };

      await inspect();
      if (!completedRef.current) setConnectStatus('waiting_qr');

      intervalRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (!completedRef.current) {
              completedRef.current = true;
              setConnectStatus('error');
              setConnectError('Tempo para leitura do QR Code expirou. Clique em Conectar para gerar um novo QR.');
              void markDeviceStatus(device.id, 'error', { metadata: { ...(device.metadata ?? {}), last_error: 'qr_timeout' } });
            }
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
        if (!completedRef.current) void inspect();
      }, 1000);
    } catch (e: any) {
      completedRef.current = true;
      setConnectStatus('error');
      setConnectError(e?.message || 'Erro ao iniciar conexão com a ZAP Call');
      await markDeviceStatus(device.id, 'error', { metadata: { ...(device.metadata ?? {}), last_error: e?.message || 'sdk_init_error' } });
      await load();
    }
  }, [appUserId, ensureWebphone, load, markDeviceStatus, openWidget, refreshDevices, resetConnectionState, syncDeviceAsConnected]);

  const closeConnectDialog = useCallback(() => {
    setConnectingDevice(null);
    resetConnectionState();
  }, [resetConnectionState]);

  const handleClaim = async () => {
    if (!clientId || !appUserId) { toast.error('Sessão inválida'); return; }
    if (!newName.trim()) { toast.error('Informe um nome'); return; }
    setBusy(true);
    try {
      const { data: candidates, error: qErr } = await (supabase as any)
        .from('wavoip_devices')
        .select('*')
        .eq('client_id', clientId)
        .is('app_user_id', null)
        .order('created_at', { ascending: true })
        .limit(1);
      if (qErr) throw qErr;
      const device = candidates?.[0] as Device | undefined;
      if (!device) { toast.error('Nenhum dispositivo disponível no seu plano. Solicite mais dispositivos ao administrador.'); return; }

      const { data: updated, error: updErr } = await (supabase as any)
        .from('wavoip_devices')
        .update({ app_user_id: appUserId, device_name: newName.trim(), connection_status: 'disconnected', connected_at: null, whatsapp_jids: [], whatsapp_jid: null, whatsapp_number: null })
        .eq('id', device.id)
        .select('*')
        .single();
      if (updErr) throw updErr;

      toast.success('Dispositivo adicionado. Escaneie o QR Code para conectar.');
      // Sincroniza o nome amigável no backend Wavoip para que o widget mostre
      // "Ligando de <device_name>" em vez do UUID do dispositivo.
      try {
        supabase.functions.invoke('wavoip-rename-device', { body: { device_id: device.id } });
      } catch {}
      // Vincula filas selecionadas, se houver.
      if (newDeviceQueueIds.length > 0 && clientId != null) {
        try {
          await setDeviceQueuesMut.mutateAsync({
            deviceId: device.id,
            clientId: Number(clientId),
            queueIds: newDeviceQueueIds,
            createdBy: appUserId,
          });
        } catch {}
      }
      setNewDeviceQueueIds([]);
      setDialogOpen(false);
      setNewName('');
      await load();
      await startConnectFlow(updated as Device);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adicionar');
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async (device: Device) => {
    const wp: any = (window as any).wavoip;
    try { wp?.device?.disable?.(device.device_token); } catch {}
    try { wp?.device?.remove?.(device.device_token); } catch {}
    const { error } = await (supabase as any).from('wavoip_devices').update({
      app_user_id: null,
      connection_status: 'disconnected',
      connected_at: null,
      whatsapp_jids: [],
      whatsapp_jid: null,
      whatsapp_number: null,
    }).eq('id', device.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Dispositivo liberado');
    await load();
    await refreshDevices();
  };

  const handleDisconnect = async (device: Device) => {
    const wp: any = (window as any).wavoip;
    try { wp?.device?.disable?.(device.device_token); } catch {}
    try { wp?.device?.remove?.(device.device_token); } catch {}
    try {
      const { data, error } = await supabase.functions.invoke('wavoip-disconnect-device', {
        body: { device_id: device.id },
      });
      if (error) {
        toast.error(`Falha ao desconectar na ZAP Call: ${error.message}`);
      } else if (data && (data as any).ok === false) {
        toast.error('ZAP Call não confirmou o logout do WhatsApp; registro marcado como desconectado local.');
      } else {
        toast.success('Dispositivo desconectado');
      }
    } catch (e: any) {
      toast.error(`Falha ao desconectar: ${e?.message ?? e}`);
    }
    await load();
    await refreshDevices();
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) { toast.error('Informe um nome'); return; }
    setRenameBusy(true);
    try {
      const { error } = await (supabase as any)
        .from('wavoip_devices')
        .update({ device_name: name })
        .eq('id', renameTarget.id);
      if (error) throw error;
      try {
        await supabase.functions.invoke('wavoip-rename-device', { body: { device_id: renameTarget.id, name } });
      } catch (e) {
        console.warn('[wavoip] rename remote falhou', e);
      }
      if (clientId != null) {
        try {
          await setDeviceQueuesMut.mutateAsync({
            deviceId: renameTarget.id,
            clientId: Number(clientId),
            queueIds: renameQueueIds,
            createdBy: appUserId,
          });
        } catch (e) {
          console.warn('[wavoip] salvar filas vinculadas falhou', e);
        }
      }
      toast.success('Dispositivo atualizado');
      setRenameTarget(null);
      setRenameValue('');
      setRenameQueueIds([]);
      await load();
      await refreshDevices();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao renomear');
    } finally {
      setRenameBusy(false);
    }
  };

  const connectProgress = Math.max(0, Math.min(100, ((QR_TIMEOUT_SECONDS - countdown) / QR_TIMEOUT_SECONDS) * 100));
  const activeQrUrl = qrText
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrText)}`
    : qrUrl;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">ZAP Call</h1>
            <p className="text-sm text-muted-foreground">Chamadas de voz WhatsApp via ZAP Call</p>
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
            Você ainda não possui um plano ZAP Call ativo. Solicite a ativação ao administrador.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="devices" className="w-full">
        <TabsList>
          <TabsTrigger value="devices">Meus dispositivos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="devices" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Meus dispositivos</CardTitle>
                {hasActivePlan && (
                  <Badge variant="secondary">
                    {slotStats.used} {slotStats.used === 1 ? 'usado' : 'usados'} / {slotStats.total} {slotStats.total === 1 ? 'disponível' : 'disponíveis'}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => (limitReached ? setLimitDialogOpen(true) : setDialogOpen(true))} disabled={!hasActivePlan}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar dispositivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dispositivo cadastrado para você.</p>
              ) : (
                <div className="divide-y border rounded-md">
                  {myDevices.map((d) => {
                    const jids: string[] = Array.isArray(d.whatsapp_jids) ? d.whatsapp_jids : [];
                    // Fonte da verdade: status ao vivo do SDK. Se não houver
                    // resposta do SDK ainda, cai no valor do DB.
                    const liveRaw = liveDeviceStatuses?.[d.device_token];
                    const liveStatus: string = liveRaw
                      ? (liveRaw === 'open' ? 'connected'
                          : liveRaw === 'connecting' || liveRaw === 'waiting_qr' || liveRaw === 'pairing' ? 'connecting'
                          : liveRaw === 'error' || liveRaw === 'external_integration_error' || liveRaw === 'waiting_payment' ? 'error'
                          : 'disconnected')
                      : d.connection_status;
                    const connected = liveStatus === 'connected';
                    const isOwner = Number(d.app_user_id) === appUserId;
                    const memberCount = membersByDevice[d.id] || 0;
                    return (
                      <div key={d.id} className="flex items-center justify-between p-3 gap-4">
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            {d.device_name || `WAPhone_${d.friendly_code ?? ''}`}
                            {isOwner && memberCount > 0 && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Users2 className="h-3 w-3" /> +{memberCount}
                              </Badge>
                            )}
                            {!isOwner && (
                              <Badge variant="outline" className="text-xs">Compartilhado</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Token: <span className="font-mono">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</span>
                            {d.whatsapp_number && <> · Número: {d.whatsapp_number}</>}
                            {jids.length > 0 && <> · JID: {jids.join(', ')}</>}
                          </div>
                          {(queuesByDevice[d.id]?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {queuesByDevice[d.id].map((qid) => (
                                <Badge key={qid} variant="secondary" className="text-[10px] font-normal">
                                  {queueNameById[qid] || 'Fila'}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={connected ? 'default' : liveStatus === 'error' ? 'destructive' : 'outline'}>
                            {connected ? 'conectado' : liveStatus === 'connecting' ? 'aguardando QR' : liveStatus === 'error' ? 'erro' : 'desconectado'}
                          </Badge>
                          {d.webhook_status && d.webhook_status !== 'never' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={d.webhook_status === 'ok' ? 'outline' : 'destructive'}
                                    className="gap-1 cursor-help"
                                  >
                                    {d.webhook_status === 'ok' ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                                    Webhook {d.webhook_status === 'ok' ? 'OK' : d.webhook_status === 'stale' ? 'inativo' : 'não verificado'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm text-xs">
                                  <div className="break-all"><b>URL esperada:</b><br />{d.webhook_url || '—'}</div>
                                  {d.webhook_checked_at && <div><b>Verificado:</b> {format(new Date(d.webhook_checked_at), 'dd/MM HH:mm')}</div>}
                                  {d.webhook_last_error && <div className="text-destructive break-all"><b>Aviso:</b> {d.webhook_last_error}</div>}
                                  <div className="text-muted-foreground pt-1 mt-1 border-t">Configure no painel da ZAP Call → Dispositivo → Integrações → Webhook. Eventos: CALL, RECORD, DEVICE.</div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {d.webhook_status && d.webhook_status !== 'ok' && d.webhook_status !== 'never' && (
                            <Button variant="outline" size="sm" onClick={async () => {
                              const url = d.webhook_url || '';
                              if (!url) { toast.error('URL ainda não disponível — clique em Verificar webhooks'); return; }
                              try { await navigator.clipboard.writeText(url); toast.success('URL copiada — cole em Integrações → Webhook na ZAP Call'); }
                              catch { toast.error('Não foi possível copiar'); }
                            }}>
                              <Copy className="h-4 w-4 mr-1" /> Copiar URL
                            </Button>
                          )}
                          {isOwner && (connected ? (
                            <Button variant="outline" size="sm" onClick={() => setDisconnectTarget(d)}>
                              <Plug className="h-4 w-4 mr-1" /> Desconectar
                            </Button>
                          ) : (
                            <Button variant="default" size="sm" onClick={() => startConnectFlow(d)} disabled={connectStatus !== 'idle'}>
                              <Plug className="h-4 w-4 mr-1" /> Conectar
                            </Button>
                          ))}
                          {isOwner && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setShareTarget(d)}>
                                    <Users2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Liberar acesso à equipe</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isOwner && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setRenameTarget(d);
                                      setRenameValue(d.device_name || '');
                                      setRenameQueueIds(queuesByDevice[d.id] ?? []);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar dispositivo</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isOwner && (
                            <Button variant="ghost" size="sm" onClick={() => setReleaseTarget(d)}>
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
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <CallHistoryTab />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewDeviceQueueIds([]); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar dispositivo ZAP Call</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do dispositivo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Atendimento 01" />
              <p className="text-xs text-muted-foreground mt-1">Um dispositivo disponível do seu plano será reservado e em seguida será exibido o QR Code para vincular o WhatsApp.</p>
            </div>
            <div>
              <Label>Vincular às filas (opcional)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Ao ligar por ZAP Call a partir do chat, este dispositivo será pré-selecionado quando a conversa pertencer a uma dessas filas.
              </p>
              {allQueuesForClient.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma fila ativa disponível.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {allQueuesForClient.map((q) => {
                    const checked = newDeviceQueueIds.includes(q.id);
                    return (
                      <label key={q.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            setNewDeviceQueueIds((prev) =>
                              prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                            );
                          }}
                        />
                        <span className="text-sm">{q.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setNewDeviceQueueIds([]); }}>Cancelar</Button>
            <Button onClick={handleClaim} disabled={busy || !newName.trim()}>
              {busy ? 'Adicionando…' : 'Adicionar e conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!connectingDevice} onOpenChange={(open) => { if (!open) closeConnectDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> Conectar dispositivo ZAP Call
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="font-medium">{connectingDevice?.device_name || 'Dispositivo'}</div>
              <div className="text-xs text-muted-foreground font-mono">{connectingDevice?.device_token}</div>
            </div>

            {connectStatus === 'open' ? (
              <Alert className="border-green-200 bg-green-50 text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Conectado</AlertTitle>
                <AlertDescription>
                  WhatsApp vinculado{sdkSnapshot?.contact?.phone ? ` ao número ${sdkSnapshot.contact.phone}` : ''}. O discador já pode ser usado.
                </AlertDescription>
              </Alert>
            ) : connectStatus === 'error' ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Não foi possível conectar</AlertTitle>
                <AlertDescription>{connectError}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-xl border bg-white p-3 shadow-sm min-h-[286px] min-w-[286px] flex items-center justify-center">
                    {activeQrUrl ? (
                      <img
                        src={activeQrUrl}
                        alt="QR Code para conectar WhatsApp na ZAP Call"
                        className="h-[260px] w-[260px] object-contain"
                        onError={() => {
                          if (connectingDevice) setQrUrl(qrImageUrl(connectingDevice.device_token));
                        }}
                      />
                    ) : (
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho e leia o QR Code.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{connectStatus === 'preparing' ? 'Preparando conexão…' : 'Aguardando leitura do QR Code…'}</span>
                    <span>{countdown}s</span>
                  </div>
                  <Progress value={connectProgress} />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeConnectDialog}>Fechar</Button>
            {connectingDevice && connectStatus === 'error' && (
              <Button onClick={() => startConnectFlow(connectingDevice)}>Gerar novo QR</Button>
            )}
            {connectStatus === 'open' && <Button onClick={openWidget}>Abrir discador</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDeviceDialog
        open={!!shareTarget}
        onOpenChange={(o) => { if (!o) { setShareTarget(null); void load(); } }}
        deviceId={shareTarget?.id ?? null}
        deviceName={shareTarget?.device_name || 'Dispositivo'}
        ownerUserId={shareTarget ? Number(shareTarget.app_user_id) : null}
        currentUserId={appUserId}
      />

      <ConfirmDeleteDialog
        open={!!disconnectTarget}
        onOpenChange={(o) => { if (!o) setDisconnectTarget(null); }}
        title="Desconectar dispositivo"
        description={<>A sessão do WhatsApp em <b>{disconnectTarget?.device_name || 'dispositivo'}</b> será encerrada. Para voltar a usá-lo, será necessário ler um novo QR Code.</>}
        confirmLabel="Desconectar"
        toggleLabel="Confirmo que quero desconectar este dispositivo"
        loading={actionBusy}
        onConfirm={async () => {
          if (!disconnectTarget) return;
          setActionBusy(true);
          try { await handleDisconnect(disconnectTarget); } finally { setActionBusy(false); setDisconnectTarget(null); }
        }}
      />

      <ConfirmDeleteDialog
        open={!!releaseTarget}
        onOpenChange={(o) => { if (!o) setReleaseTarget(null); }}
        title="Liberar dispositivo"
        description={<>O dispositivo <b>{releaseTarget?.device_name || ''}</b> será devolvido ao pool do escritório e o vínculo com o seu usuário será removido.</>}
        confirmLabel="Liberar"
        toggleLabel="Confirmo que quero liberar este dispositivo"
        loading={actionBusy}
        onConfirm={async () => {
          if (!releaseTarget) return;
          setActionBusy(true);
          try { await handleRelease(releaseTarget); } finally { setActionBusy(false); setReleaseTarget(null); }
        }}
      />

      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) { setRenameTarget(null); setRenameValue(''); setRenameQueueIds([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar dispositivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do dispositivo *</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="ex: Atendimento 01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O nome também é sincronizado no painel da ZAP Call para aparecer no discador.
              </p>
            </div>
            <div>
              <Label>Vincular às filas (opcional)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Ao ligar por ZAP Call a partir do chat, este dispositivo será pré-selecionado quando a conversa pertencer a uma dessas filas.
              </p>
              {allQueuesForClient.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma fila ativa disponível.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {allQueuesForClient.map((q) => {
                    const checked = renameQueueIds.includes(q.id);
                    return (
                      <label key={q.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            setRenameQueueIds((prev) =>
                              prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                            );
                          }}
                        />
                        <span className="text-sm">{q.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setRenameValue(''); setRenameQueueIds([]); }}>Cancelar</Button>
            <Button onClick={handleRename} disabled={renameBusy || !renameValue.trim()}>
              {renameBusy ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Limite de dispositivos atingido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Você já está usando <b>{slotStats.used}</b> de <b>{slotStats.total}</b>{' '}
              {slotStats.total === 1 ? 'dispositivo disponível' : 'dispositivos disponíveis'} no seu plano.
            </p>
            <p>
              Para adicionar um novo dispositivo, é necessário adquirir mais dispositivos de ligação{' '}
              <b>ZAP Call</b>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}