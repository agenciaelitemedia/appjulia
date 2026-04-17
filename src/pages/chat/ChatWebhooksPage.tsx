import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Edit, Webhook, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Hook {
  id: string;
  client_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
}

interface Delivery {
  id: string; webhook_id: string; event: string; status_code: number | null;
  success: boolean; error_message: string | null; delivered_at: string;
}

const EVENTS = [
  { id: 'conversation_created', label: 'Nova conversa' },
  { id: 'message_received', label: 'Mensagem recebida' },
  { id: 'conversation_resolved', label: 'Conversa resolvida' },
  { id: 'conversation_assigned', label: 'Atribuição' },
];

export default function ChatWebhooksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = String(user?.id ?? '');
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Hook> | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: h }, { data: d }] = await Promise.all([
      supabase.from('chat_webhooks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('chat_webhook_deliveries').select('*').order('delivered_at', { ascending: false }).limit(20),
    ]);
    setHooks((h ?? []) as Hook[]);
    setDeliveries((d ?? []) as Delivery[]);
    setLoading(false);
  };

  useEffect(() => { if (clientId) load(); /* eslint-disable-next-line */ }, [clientId]);

  const toggle = async (h: Hook) => { await supabase.from('chat_webhooks').update({ is_active: !h.is_active }).eq('id', h.id); load(); };
  const remove = async (id: string) => { if (!confirm('Excluir webhook?')) return; await supabase.from('chat_webhooks').delete().eq('id', id); load(); };
  const save = async () => {
    if (!editing?.name || !editing?.url || !editing?.events?.length) { toast.error('Preencha nome, URL e ao menos 1 evento'); return; }
    const payload = { client_id: clientId, name: editing.name, url: editing.url, secret: editing.secret || null, events: editing.events, is_active: editing.is_active ?? true };
    if (editing.id) await supabase.from('chat_webhooks').update(payload).eq('id', editing.id);
    else await supabase.from('chat_webhooks').insert(payload);
    toast.success('Webhook salvo');
    setEditing(null); load();
  };

  const test = async (h: Hook) => {
    const { data, error } = await supabase.functions.invoke('chat-webhook-dispatcher', {
      body: { event: h.events[0], client_id: clientId, payload: { test: true, webhook_id: h.id } },
    });
    if (error) toast.error(`Falha: ${error.message}`);
    else toast.success(`Disparado: ${(data as any)?.delivered ?? 0} entrega(s)`);
    setTimeout(load, 1500);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" /> Webhooks de Chat</h2>
            <p className="text-muted-foreground text-sm">Notifique sistemas externos quando eventos acontecem</p>
          </div>
        </div>
        <Button onClick={() => setEditing({ is_active: true, events: ['conversation_created'] })}><Plus className="h-4 w-4 mr-1" /> Novo webhook</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : hooks.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground"><Webhook className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Nenhum webhook configurado.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {hooks.map(h => (
            <Card key={h.id} className={h.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={h.is_active} onCheckedChange={() => toggle(h)} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{h.name}</h3>
                  <p className="text-xs text-muted-foreground truncate font-mono">{h.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {h.events.map(e => <Badge key={e} variant="outline" className="text-[10px]">{EVENTS.find(x => x.id === e)?.label ?? e}</Badge>)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => test(h)}>Testar</Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(h)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2 text-sm">Entregas recentes</h3>
            <div className="space-y-1">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                  {d.success ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                  <span className="font-mono text-muted-foreground">{d.event}</span>
                  <span className="ml-auto text-muted-foreground">{d.status_code ?? d.error_message ?? '—'}</span>
                  <span className="text-muted-foreground">{new Date(d.delivered_at).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar webhook' : 'Novo webhook'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>URL *</Label><Input value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Secret HMAC (opcional)</Label><Input value={editing.secret ?? ''} onChange={(e) => setEditing({ ...editing, secret: e.target.value })} placeholder="Validação X-Lovable-Signature" /></div>
              <div>
                <Label>Eventos *</Label>
                <div className="space-y-1 mt-1">
                  {EVENTS.map(ev => (
                    <label key={ev.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={editing.events?.includes(ev.id) ?? false}
                        onCheckedChange={(c) => {
                          const arr = new Set(editing.events ?? []);
                          if (c) arr.add(ev.id); else arr.delete(ev.id);
                          setEditing({ ...editing, events: Array.from(arr) });
                        }} />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Webhook ativo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
