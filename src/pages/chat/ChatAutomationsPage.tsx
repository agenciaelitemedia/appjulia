import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Edit, Zap, Activity, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { AutomationTemplatesDialog } from '@/components/chat/AutomationTemplatesDialog';

interface Rule {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
  position: number;
  execution_count: number;
  last_executed_at: string | null;
}

const TRIGGERS: Record<string, string> = {
  new_conversation: 'Nova conversa',
  keyword: 'Palavra-chave',
  inactivity: 'Inatividade',
  outside_hours: 'Fora de horário',
  tag_added: 'Tag adicionada',
};
const ACTIONS: Record<string, string> = {
  auto_assign: 'Atribuir atendente',
  auto_tag: 'Adicionar tag',
  send_message: 'Enviar mensagem',
  auto_close: 'Fechar conversa',
  set_priority: 'Definir prioridade',
  transfer_queue: 'Transferir fila',
};

export default function ChatAutomationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const clientId = String(user?.id ?? '');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('chat_automation_rules').select('*')
      .eq('client_id', clientId).order('position');
    setRules((data ?? []) as Rule[]);
    setLoading(false);
  };

  useEffect(() => { if (clientId) load(); /* eslint-disable-next-line */ }, [clientId]);

  const toggle = async (r: Rule) => {
    await supabase.from('chat_automation_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await supabase.from('chat_automation_rules').delete().eq('id', id);
    toast.success('Regra excluída');
    load();
  };

  const save = async () => {
    if (!editing?.name || !editing.trigger_type || !editing.action_type) {
      toast.error('Preencha nome, gatilho e ação');
      return;
    }
    const payload = {
      client_id: clientId,
      name: editing.name,
      description: editing.description ?? null,
      is_active: editing.is_active ?? true,
      trigger_type: editing.trigger_type,
      trigger_config: editing.trigger_config ?? {},
      action_type: editing.action_type,
      action_config: editing.action_config ?? {},
    };
    if (editing.id) {
      await supabase.from('chat_automation_rules').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('chat_automation_rules').insert(payload);
    }
    toast.success('Regra salva');
    setEditing(null);
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Automações de Chat</h2>
            <p className="text-muted-foreground text-sm">Regras automáticas para atribuição, tags, mensagens e fechamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            <Sparkles className="h-4 w-4 mr-1 text-amber-500" /> Templates
          </Button>
          <Button onClick={() => setEditing({ is_active: true, trigger_type: 'new_conversation', action_type: 'auto_tag', trigger_config: {}, action_config: {} })}>
            <Plus className="h-4 w-4 mr-1" /> Nova regra
          </Button>
        </div>
      </div>

      <AutomationTemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        clientId={clientId}
        onCreated={load}
      />

      {loading ? (
        <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : rules.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma regra criada ainda. Clique em "Nova regra" para começar.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id} className={r.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{r.name}</h3>
                    <Badge variant="outline">{TRIGGERS[r.trigger_type] ?? r.trigger_type}</Badge>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Badge>{ACTIONS[r.action_type] ?? r.action_type}</Badge>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Executada {r.execution_count}x
                    {r.last_executed_at && ` · última ${new Date(r.last_executed_at).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar regra' : 'Nova regra'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gatilho *</Label>
                  <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v, trigger_config: {} })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGERS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ação *</Label>
                  <Select value={editing.action_type} onValueChange={(v) => setEditing({ ...editing, action_type: v, action_config: {} })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIONS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trigger config */}
              {editing.trigger_type === 'keyword' && (
                <div>
                  <Label>Palavras-chave (separadas por vírgula)</Label>
                  <Input
                    value={(editing.trigger_config?.keywords ?? []).join(', ')}
                    onChange={(e) => setEditing({ ...editing, trigger_config: { keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                    placeholder="orçamento, preço, valor"
                  />
                </div>
              )}
              {editing.trigger_type === 'inactivity' && (
                <div>
                  <Label>Minutos de inatividade</Label>
                  <Input type="number" min={5}
                    value={editing.trigger_config?.minutes ?? 60}
                    onChange={(e) => setEditing({ ...editing, trigger_config: { minutes: Number(e.target.value) } })} />
                </div>
              )}
              {editing.trigger_type === 'outside_hours' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início</Label><Input type="time" value={editing.trigger_config?.start ?? '08:00'} onChange={(e) => setEditing({ ...editing, trigger_config: { ...editing.trigger_config, start: e.target.value } })} /></div>
                  <div><Label>Fim</Label><Input type="time" value={editing.trigger_config?.end ?? '18:00'} onChange={(e) => setEditing({ ...editing, trigger_config: { ...editing.trigger_config, end: e.target.value } })} /></div>
                </div>
              )}
              {editing.trigger_type === 'tag_added' && (
                <div><Label>Tag</Label><Input value={editing.trigger_config?.tag ?? ''} onChange={(e) => setEditing({ ...editing, trigger_config: { tag: e.target.value } })} /></div>
              )}

              {/* Action config */}
              {editing.action_type === 'auto_assign' && (
                <div><Label>Identificador do atendente</Label><Input value={editing.action_config?.assigned_to ?? ''} onChange={(e) => setEditing({ ...editing, action_config: { assigned_to: e.target.value } })} placeholder="user_123 ou email" /></div>
              )}
              {editing.action_type === 'auto_tag' && (
                <div><Label>Tag</Label><Input value={editing.action_config?.tag ?? ''} onChange={(e) => setEditing({ ...editing, action_config: { tag: e.target.value } })} placeholder="vip, suporte..." /></div>
              )}
              {editing.action_type === 'send_message' && (
                <div><Label>Mensagem</Label><Textarea rows={3} value={editing.action_config?.text ?? ''} onChange={(e) => setEditing({ ...editing, action_config: { text: e.target.value } })} placeholder="Olá! Recebemos sua mensagem fora do nosso horário..." /></div>
              )}
              {editing.action_type === 'auto_close' && (
                <div><Label>Motivo (opcional)</Label><Input value={editing.action_config?.reason ?? ''} onChange={(e) => setEditing({ ...editing, action_config: { reason: e.target.value } })} /></div>
              )}
              {editing.action_type === 'set_priority' && (
                <div>
                  <Label>Prioridade</Label>
                  <Select value={editing.action_config?.priority ?? 'normal'} onValueChange={(v) => setEditing({ ...editing, action_config: { priority: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.action_type === 'transfer_queue' && (
                <div><Label>ID da fila</Label><Input value={editing.action_config?.queue_id ?? ''} onChange={(e) => setEditing({ ...editing, action_config: { queue_id: e.target.value } })} /></div>
              )}

              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Regra ativa</Label></div>
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
