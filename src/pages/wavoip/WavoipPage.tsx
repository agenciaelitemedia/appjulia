import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, Plus, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWavoip } from '@/contexts/WavoipContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Device = { id: string; device_token: string; device_name: string | null; whatsapp_number: string | null; status: string; created_at: string };

export default function WavoipPage() {
  const { hasActivePlan, ready, openWidget, refreshDevices } = useWavoip();
  const [userId, setUserId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ device_token: '', device_name: '', whatsapp_number: '' });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('wavoip_devices').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDevices((data ?? []) as Device[]);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [userId]);

  const handleAdd = async () => {
    if (!userId) return;
    if (!form.device_token.trim()) { toast.error('Informe o token do dispositivo'); return; }
    const { error } = await (supabase as any).from('wavoip_devices').insert({
      user_id: userId,
      device_token: form.device_token.trim(),
      device_name: form.device_name || null,
      whatsapp_number: form.whatsapp_number || null,
      status: 'pending',
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Dispositivo adicionado');
    setDialogOpen(false);
    setForm({ device_token: '', device_name: '', whatsapp_number: '' });
    await load();
    await refreshDevices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este dispositivo?')) return;
    const { error } = await (supabase as any).from('wavoip_devices').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Dispositivo removido');
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
          <Button variant="outline" onClick={openWidget} disabled={!ready}>Abrir discador</Button>
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
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{d.device_name || 'Dispositivo Wavoip'}</div>
                    <div className="text-xs text-muted-foreground">
                      Token: <span className="font-mono">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</span>
                      {d.whatsapp_number && <> · WhatsApp: {d.whatsapp_number}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{d.status}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar dispositivo Wavoip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Token do dispositivo *</Label>
              <Input value={form.device_token} onChange={(e) => setForm({ ...form, device_token: e.target.value })} placeholder="cole o token gerado no painel Wavoip" />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} placeholder="ex: Atendimento 01" />
            </div>
            <div>
              <Label>WhatsApp vinculado</Label>
              <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="55XXXXXXXXXXX" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}