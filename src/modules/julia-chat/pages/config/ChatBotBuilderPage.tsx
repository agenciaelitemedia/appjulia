import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MessageSquare, GitBranch, UserCog, Tag as TagIcon, Flag, Workflow, ArrowRight } from 'lucide-react';
import { useChatBotFlows, type BotFlow, type FlowNode, type FlowEdge } from '@/hooks/useChatBotFlows';

const NODE_TYPES = [
  { value: 'message', label: 'Mensagem', icon: MessageSquare, color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  { value: 'question', label: 'Pergunta', icon: GitBranch, color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  { value: 'condition', label: 'Condição', icon: GitBranch, color: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
  { value: 'handoff', label: 'Transferir p/ humano', icon: UserCog, color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  { value: 'tag', label: 'Adicionar tag', icon: TagIcon, color: 'bg-pink-500/10 text-pink-700 border-pink-500/30' },
  { value: 'end', label: 'Encerrar', icon: Flag, color: 'bg-red-500/10 text-red-700 border-red-500/30' },
] as const;

export default function ChatBotBuilderPage() {
  const { list, upsert, remove, toggleActive } = useChatBotFlows();
  const [editing, setEditing] = useState<Partial<BotFlow> | null>(null);

  const newFlow = () => setEditing({
    name: 'Novo fluxo',
    description: '',
    is_active: false,
    trigger_keywords: [],
    trigger_type: 'keyword',
    match_mode: 'contains',
    only_business_hours: false,
    nodes: [],
    edges: [],
    start_node_id: null,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Workflow className="h-6 w-6 text-primary" /> Construtor de Chatbot</h1>
          <p className="text-sm text-muted-foreground">Fluxos visuais com mensagens, perguntas, condições e handoff humano.</p>
        </div>
        <Button onClick={newFlow}><Plus className="h-4 w-4 mr-2" /> Novo fluxo</Button>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(list.data || []).map((flow) => (
          <Card key={flow.id} className="p-4 space-y-3 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{flow.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{flow.description || 'Sem descrição'}</p>
              </div>
              <Switch checked={flow.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: flow.id, is_active: v })} />
            </div>
            <div className="flex flex-wrap gap-1">
              {flow.trigger_keywords?.map((kw, i) => <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>)}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{flow.nodes?.length || 0} nós · {flow.edges?.length || 0} conexões</span>
              <span>{flow.execution_count || 0} execuções</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(flow)}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(flow.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {!list.isLoading && (list.data || []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground col-span-2">
            <Workflow className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Nenhum fluxo criado. Clique em "Novo fluxo" para começar.
          </Card>
        )}
      </div>

      {editing && (
        <FlowEditor flow={editing} onClose={() => setEditing(null)} onSave={(f) => { upsert.mutate(f); setEditing(null); }} />
      )}
    </div>
  );
}

function FlowEditor({ flow, onClose, onSave }: { flow: Partial<BotFlow>; onClose: () => void; onSave: (f: Partial<BotFlow>) => void }) {
  const [draft, setDraft] = useState<Partial<BotFlow>>(flow);
  const nodes = draft.nodes || [];
  const edges = draft.edges || [];

  const addNode = (type: FlowNode['type']) => {
    const id = `n_${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type,
      position: { x: 100 + nodes.length * 50, y: 100 + nodes.length * 80 },
      data: { label: NODE_TYPES.find((t) => t.value === type)?.label || 'Novo', text: '' },
    };
    setDraft({ ...draft, nodes: [...nodes, newNode], start_node_id: draft.start_node_id || id });
  };

  const updateNode = (id: string, patch: Partial<FlowNode['data']>) => {
    setDraft({ ...draft, nodes: nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n) });
  };

  const removeNode = (id: string) => {
    setDraft({
      ...draft,
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
      start_node_id: draft.start_node_id === id ? null : draft.start_node_id,
    });
  };

  const connectNodes = (source: string, target: string, label?: string) => {
    if (source === target) return;
    if (edges.some((e) => e.source === source && e.target === target)) return;
    setDraft({ ...draft, edges: [...edges, { id: `e_${Date.now()}`, source, target, label }] });
  };

  const removeEdge = (id: string) => setDraft({ ...draft, edges: edges.filter((e) => e.id !== id) });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar fluxo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Modo de gatilho</Label>
            <Select value={draft.match_mode || 'contains'} onValueChange={(v) => setDraft({ ...draft, match_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="exact">Exato</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={(draft.trigger_keywords || []).join(', ')}
              onChange={(e) => setDraft({ ...draft, trigger_keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="ola, oi, menu"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.only_business_hours || false} onCheckedChange={(v) => setDraft({ ...draft, only_business_hours: v })} />
            <Label>Apenas em horário comercial</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.is_active || false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            <Label>Ativo</Label>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Nós do fluxo</h3>
            <div className="flex gap-1 flex-wrap">
              {NODE_TYPES.map((t) => (
                <Button key={t.value} size="sm" variant="outline" onClick={() => addNode(t.value)} className="text-xs gap-1">
                  <t.icon className="h-3 w-3" /> {t.label}
                </Button>
              ))}
            </div>
          </div>

          {nodes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Adicione nós usando os botões acima.</p>
          )}

          <div className="space-y-2">
            {nodes.map((node) => {
              const cfg = NODE_TYPES.find((t) => t.value === node.type)!;
              const Icon = cfg.icon;
              const isStart = draft.start_node_id === node.id;
              return (
                <Card key={node.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`gap-1 ${cfg.color}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                      {isStart && <Badge className="text-[10px]">Início</Badge>}
                      <span className="text-xs text-muted-foreground font-mono">{node.id}</span>
                    </div>
                    <div className="flex gap-1">
                      {!isStart && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDraft({ ...draft, start_node_id: node.id })}>
                          Definir início
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeNode(node.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(node.type === 'message' || node.type === 'question') && (
                    <Textarea
                      rows={2}
                      placeholder={node.type === 'question' ? 'Pergunta para o cliente...' : 'Mensagem para enviar...'}
                      value={node.data.text || ''}
                      onChange={(e) => updateNode(node.id, { text: e.target.value })}
                    />
                  )}
                  {node.type === 'tag' && (
                    <Input placeholder="Nome da tag" value={node.data.tag || ''} onChange={(e) => updateNode(node.id, { tag: e.target.value })} />
                  )}
                  {node.type === 'condition' && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Campo" value={node.data.field || ''} onChange={(e) => updateNode(node.id, { field: e.target.value })} />
                      <Select value={node.data.operator || 'equals'} onValueChange={(v) => updateNode(node.id, { operator: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">igual</SelectItem>
                          <SelectItem value="contains">contém</SelectItem>
                          <SelectItem value="starts_with">começa com</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Valor" value={node.data.value || ''} onChange={(e) => updateNode(node.id, { value: e.target.value })} />
                    </div>
                  )}
                  <NodeConnector node={node} allNodes={nodes} edges={edges} onConnect={connectNodes} onRemoveEdge={removeEdge} />
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(draft)}>Salvar fluxo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NodeConnector({ node, allNodes, edges, onConnect, onRemoveEdge }: {
  node: FlowNode; allNodes: FlowNode[]; edges: FlowEdge[];
  onConnect: (src: string, tgt: string, label?: string) => void;
  onRemoveEdge: (id: string) => void;
}) {
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const outgoing = edges.filter((e) => e.source === node.id);
  const candidates = allNodes.filter((n) => n.id !== node.id);

  return (
    <div className="border-t pt-2 space-y-1">
      <div className="text-[11px] text-muted-foreground font-semibold uppercase">Conexões de saída</div>
      {outgoing.map((e) => {
        const tgt = allNodes.find((n) => n.id === e.target);
        return (
          <div key={e.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono">{tgt?.data.label || e.target}</span>
            {e.label && <Badge variant="secondary" className="text-[10px]">{e.label}</Badge>}
            <Button size="sm" variant="ghost" className="h-6 ml-auto text-destructive" onClick={() => onRemoveEdge(e.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      {candidates.length > 0 && (
        <div className="flex gap-1">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Conectar a..." /></SelectTrigger>
            <SelectContent>
              {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.data.label} ({c.id})</SelectItem>)}
            </SelectContent>
          </Select>
          {(node.type === 'condition' || node.type === 'question') && (
            <Input className="h-7 text-xs w-24" placeholder="Rótulo" value={label} onChange={(e) => setLabel(e.target.value)} />
          )}
          <Button size="sm" variant="outline" className="h-7" disabled={!target} onClick={() => { onConnect(node.id, target, label || undefined); setTarget(''); setLabel(''); }}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
