import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Users, GitFork, Activity, Circle } from 'lucide-react';
import { useChatRouting, type RoutingRule, type AgentCapacity, type RoutingCondition } from '@/hooks/useChatRouting';
import { cn } from '@/lib/utils';

const STRATEGIES = [
  { value: 'round_robin', label: 'Rodízio (round-robin)' },
  { value: 'least_busy', label: 'Menos ocupado' },
  { value: 'specific_agent', label: 'Agente específico' },
  { value: 'manual_pool', label: 'Pool manual (notificar)' },
];
const STATUS = [
  { value: 'online', label: 'Online', color: 'bg-emerald-500' },
  { value: 'away', label: 'Ausente', color: 'bg-amber-500' },
  { value: 'busy', label: 'Ocupado', color: 'bg-red-500' },
  { value: 'offline', label: 'Offline', color: 'bg-muted-foreground' },
];

export default function ChatRoutingPage() {
  const { rules, capacities, upsertRule, removeRule, upsertCapacity, removeCapacity } = useChatRouting();
  const [editing, setEditing] = useState<Partial<RoutingRule> | null>(null);
  const [editingCap, setEditingCap] = useState<Partial<AgentCapacity> | null>(null);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><GitFork className="h-6 w-6 text-primary" /> Roteamento inteligente</h1>
        <p className="text-sm text-muted-foreground">Distribua novas conversas automaticamente entre agentes com base em regras e capacidade.</p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Regras de distribuição</TabsTrigger>
          <TabsTrigger value="capacity">Capacidade dos agentes</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditing({ name: 'Nova regra', is_active: true, strategy: 'round_robin', conditions: [], agent_pool: [] })}>
              <Plus className="h-4 w-4 mr-2" /> Nova regra
            </Button>
          </div>
          <div className="space-y-2">
            {(rules.data || []).map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{r.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{STRATEGIES.find(s => s.value === r.strategy)?.label}</Badge>
                    {r.only_business_hours && <Badge variant="secondary" className="text-[10px]">Horário comercial</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.conditions.length} condições · pool de {r.agent_pool.length} agentes · {r.execution_count} execuções
                  </p>
                </div>
                <Switch checked={r.is_active} onCheckedChange={(v) => upsertRule.mutate({ ...r, is_active: v })} />
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRule.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
            {!rules.isLoading && (rules.data || []).length === 0 && (
              <Card className="p-8 text-center text-muted-foreground"><Activity className="h-10 w-10 mx-auto mb-2 opacity-40" />Sem regras de roteamento.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setEditingCap({ agent_identifier: '', max_concurrent: 5, status: 'online', is_active: true })}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar agente
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {(capacities.data || []).map((c) => {
              const sc = STATUS.find(s => s.value === c.status)!;
              const pct = Math.min(100, Math.round((c.current_load / Math.max(1, c.max_concurrent)) * 100));
              return (
                <Card key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className={cn('h-2.5 w-2.5 rounded-full', sc.color)} fill="currentColor" />
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.agent_name || c.agent_identifier}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{c.agent_identifier}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditingCap(c)}>Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeCapacity.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.current_load} / {c.max_concurrent} conversas</span>
                    <span>{sc.label}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
            {(capacities.data || []).length === 0 && (
              <Card className="p-8 text-center text-muted-foreground col-span-2">Nenhum agente cadastrado.</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {editing && <RuleEditor rule={editing} pool={capacities.data || []} onClose={() => setEditing(null)} onSave={(r) => { upsertRule.mutate(r); setEditing(null); }} />}
      {editingCap && <CapacityEditor cap={editingCap} onClose={() => setEditingCap(null)} onSave={(c) => { upsertCapacity.mutate(c); setEditingCap(null); }} />}
    </div>
  );
}

function RuleEditor({ rule, pool, onClose, onSave }: { rule: Partial<RoutingRule>; pool: AgentCapacity[]; onClose: () => void; onSave: (r: Partial<RoutingRule>) => void }) {
  const [d, setD] = useState<Partial<RoutingRule>>(rule);
  const conds = d.conditions || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Regra de roteamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={d.name || ''} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
            <div>
              <Label>Estratégia</Label>
              <Select value={d.strategy} onValueChange={(v) => setD({ ...d, strategy: v as RoutingRule['strategy'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Pool de agentes</Label>
            <div className="flex flex-wrap gap-1 p-2 border rounded">
              {pool.map((p) => {
                const checked = (d.agent_pool || []).includes(p.agent_identifier);
                return (
                  <Badge
                    key={p.id}
                    variant={checked ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setD({ ...d, agent_pool: checked ? d.agent_pool!.filter((a) => a !== p.agent_identifier) : [...(d.agent_pool || []), p.agent_identifier] })}
                  >
                    {p.agent_name || p.agent_identifier}
                  </Badge>
                );
              })}
              {pool.length === 0 && <span className="text-xs text-muted-foreground">Cadastre agentes primeiro.</span>}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label>Condições (todas devem ser satisfeitas)</Label>
              <Button size="sm" variant="outline" onClick={() => setD({ ...d, conditions: [...conds, { field: 'channel', op: 'equals', value: '' } as RoutingCondition] })}>
                <Plus className="h-3 w-3 mr-1" /> Condição
              </Button>
            </div>
            {conds.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 mb-1">
                <Select value={c.field} onValueChange={(v) => { const arr = [...conds]; arr[i] = { ...c, field: v as RoutingCondition['field'] }; setD({ ...d, conditions: arr }); }}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="channel">Canal</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="priority">Prioridade</SelectItem>
                    <SelectItem value="keyword">Palavra-chave</SelectItem>
                    <SelectItem value="business_hours">Horário comercial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={c.op} onValueChange={(v) => { const arr = [...conds]; arr[i] = { ...c, op: v as RoutingCondition['op'] }; setD({ ...d, conditions: arr }); }}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">igual</SelectItem>
                    <SelectItem value="contains">contém</SelectItem>
                    <SelectItem value="in">em</SelectItem>
                    <SelectItem value="not_in">não em</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="h-8" value={c.value} onChange={(e) => { const arr = [...conds]; arr[i] = { ...c, value: e.target.value }; setD({ ...d, conditions: arr }); }} />
                <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => setD({ ...d, conditions: conds.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={d.only_business_hours || false} onCheckedChange={(v) => setD({ ...d, only_business_hours: v })} />
            <Label>Apenas em horário comercial</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(d)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapacityEditor({ cap, onClose, onSave }: { cap: Partial<AgentCapacity>; onClose: () => void; onSave: (c: Partial<AgentCapacity>) => void }) {
  const [d, setD] = useState<Partial<AgentCapacity>>(cap);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Capacidade do agente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Identificador (e-mail/ID)</Label><Input value={d.agent_identifier || ''} onChange={(e) => setD({ ...d, agent_identifier: e.target.value })} disabled={!!cap.id} /></div>
          <div><Label>Nome</Label><Input value={d.agent_name || ''} onChange={(e) => setD({ ...d, agent_name: e.target.value })} /></div>
          <div><Label>Máx. conversas simultâneas</Label><Input type="number" value={d.max_concurrent || 5} onChange={(e) => setD({ ...d, max_concurrent: Number(e.target.value) })} /></div>
          <div>
            <Label>Status</Label>
            <Select value={d.status || 'online'} onValueChange={(v) => setD({ ...d, status: v as AgentCapacity['status'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(d)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
