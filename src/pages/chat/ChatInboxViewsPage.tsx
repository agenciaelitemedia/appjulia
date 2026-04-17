import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Inbox, Plus, Trash2, Star, Filter, Users, Eye } from 'lucide-react';
import { useChatSavedViews, type SavedView, type SavedViewFilters } from '@/hooks/useChatSavedViews';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['pending', 'open', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const CHANNEL_OPTIONS = ['whatsapp_uazapi', 'whatsapp_waba', 'webchat', 'instagram'];

export default function ChatInboxViewsPage() {
  const { list, upsert, remove } = useChatSavedViews();
  const [editing, setEditing] = useState<Partial<SavedView> | null>(null);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const all = list.data || [];
    return {
      total: all.length,
      shared: all.filter((v) => v.is_shared).length,
      personal: all.filter((v) => !v.is_shared).length,
    };
  }, [list.data]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6 text-primary" /> Inbox unificada</h1>
          <p className="text-sm text-muted-foreground">Crie filtros salvos para acessar rapidamente seus conjuntos de conversas favoritos.</p>
        </div>
        <Button onClick={() => setEditing({ name: 'Nova visão', icon: 'inbox', color: '#6366f1', is_shared: false, filters: {} })}>
          <Plus className="h-4 w-4 mr-2" /> Nova visão
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Compartilhadas</div><div className="text-2xl font-bold flex items-center gap-1"><Users className="h-5 w-5" />{stats.shared}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pessoais</div><div className="text-2xl font-bold flex items-center gap-1"><Star className="h-5 w-5" />{stats.personal}</div></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(list.data || []).map((view) => (
          <Card key={view.id} className="p-4 space-y-2 hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/chat?view=${view.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${view.color}22` }}>
                  <Filter className="h-4 w-4" style={{ color: view.color || '#6366f1' }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{view.name}</h3>
                  <div className="flex gap-1 mt-0.5">
                    {view.is_shared && <Badge variant="outline" className="text-[10px] gap-1"><Users className="h-2.5 w-2.5" />Compartilhada</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => setEditing(view)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(view.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {view.filters.status?.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">status: {s}</Badge>)}
              {view.filters.channel?.map((c) => <Badge key={c} variant="secondary" className="text-[10px]">canal: {c}</Badge>)}
              {view.filters.priority?.map((p) => <Badge key={p} variant="secondary" className="text-[10px]">prio: {p}</Badge>)}
              {view.filters.unread_only && <Badge variant="secondary" className="text-[10px]">não lidas</Badge>}
              {view.filters.snoozed && <Badge variant="secondary" className="text-[10px]">adiadas</Badge>}
              {view.filters.search && <Badge variant="secondary" className="text-[10px]">"{view.filters.search}"</Badge>}
            </div>
          </Card>
        ))}
        {(list.data || []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground col-span-2">
            <Eye className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Nenhuma visão criada. Crie filtros salvos para sua equipe.
          </Card>
        )}
      </div>

      {editing && <ViewEditor view={editing} onClose={() => setEditing(null)} onSave={(v) => { upsert.mutate(v); setEditing(null); }} />}
    </div>
  );
}

function ViewEditor({ view, onClose, onSave }: { view: Partial<SavedView>; onClose: () => void; onSave: (v: Partial<SavedView>) => void }) {
  const [d, setD] = useState<Partial<SavedView>>(view);
  const f: SavedViewFilters = d.filters || {};
  const setF = (patch: Partial<SavedViewFilters>) => setD({ ...d, filters: { ...f, ...patch } });
  const toggle = (key: 'status' | 'channel' | 'priority', val: string) => {
    const arr = (f[key] as string[]) || [];
    setF({ [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] } as Partial<SavedViewFilters>);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Configurar visão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div><Label>Nome</Label><Input value={d.name || ''} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
            <div><Label>Cor</Label><Input type="color" value={d.color || '#6366f1'} onChange={(e) => setD({ ...d, color: e.target.value })} className="w-16 h-10" /></div>
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {STATUS_OPTIONS.map((s) => (
                <Badge key={s} variant={(f.status || []).includes(s) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle('status', s)}>{s}</Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Canais</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {CHANNEL_OPTIONS.map((c) => (
                <Badge key={c} variant={(f.channel || []).includes(c) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle('channel', c)}>{c}</Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Prioridade</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRIORITY_OPTIONS.map((p) => (
                <Badge key={p} variant={(f.priority || []).includes(p) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle('priority', p)}>{p}</Badge>
              ))}
            </div>
          </div>
          <div><Label>Atribuído a (opcional)</Label><Input value={f.assigned_to || ''} onChange={(e) => setF({ assigned_to: e.target.value })} placeholder="ID do agente" /></div>
          <div><Label>Busca livre</Label><Input value={f.search || ''} onChange={(e) => setF({ search: e.target.value })} placeholder="Termo no nome ou mensagem" /></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><Switch checked={f.unread_only || false} onCheckedChange={(v) => setF({ unread_only: v })} /><Label>Apenas não lidas</Label></div>
            <div className="flex items-center gap-2"><Switch checked={f.snoozed || false} onCheckedChange={(v) => setF({ snoozed: v })} /><Label>Apenas adiadas</Label></div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <Switch checked={d.is_shared || false} onCheckedChange={(v) => setD({ ...d, is_shared: v })} />
            <Label>Compartilhar com a equipe</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(d)}>Salvar visão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
