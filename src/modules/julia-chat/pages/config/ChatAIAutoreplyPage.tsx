import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, Bot, BookOpen } from 'lucide-react';
import { useChatAIAutoreply, type AIAutoreplyRule } from '@/hooks/useChatAIAutoreply';

const MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (preciso)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'GPT-5 (premium)' },
];

export default function ChatAIAutoreplyPage() {
  const { list, upsert, remove, toggleActive } = useChatAIAutoreply();
  const [editing, setEditing] = useState<Partial<AIAutoreplyRule> | null>(null);

  const newRule = () => setEditing({
    name: 'Nova regra de IA',
    description: '',
    is_active: false,
    match_intents: [],
    match_keywords: [],
    use_knowledge_base: true,
    system_prompt: 'Você é um atendente cordial e objetivo. Responda em português, com clareza e empatia.',
    model: 'google/gemini-2.5-flash',
    max_replies_per_conversation: 3,
    handoff_after_max: true,
    only_business_hours: false,
    confidence_threshold: 0.6,
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> IA Auto-resposta</h1>
          <p className="text-sm text-muted-foreground">Bot inteligente com base de conhecimento, classificação de intenção e handoff humano.</p>
        </div>
        <Button onClick={newRule}><Plus className="h-4 w-4 mr-2" />Nova regra</Button>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {(list.data || []).map((rule) => (
          <Card key={rule.id} className="p-4 space-y-2 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold flex items-center gap-2 truncate"><Bot className="h-4 w-4 text-primary" />{rule.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{rule.description || 'Sem descrição'}</p>
              </div>
              <Switch checked={rule.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: rule.id, is_active: v })} />
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {rule.use_knowledge_base && <Badge variant="secondary" className="gap-1"><BookOpen className="h-2.5 w-2.5" />KB</Badge>}
              <Badge variant="outline">{rule.model.split('/')[1]}</Badge>
              <Badge variant="outline">máx {rule.max_replies_per_conversation} respostas</Badge>
              {rule.handoff_after_max && <Badge variant="outline">handoff humano</Badge>}
            </div>
            {(rule.match_keywords?.length > 0 || rule.match_intents?.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {rule.match_intents.map((i, n) => <Badge key={n} className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">intent: {i}</Badge>)}
                {rule.match_keywords.map((k, n) => <Badge key={n} variant="secondary" className="text-[10px]">{k}</Badge>)}
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{rule.execution_count} execuções</span>
              <span>conf. mín {Math.round(rule.confidence_threshold * 100)}%</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(rule)}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(rule.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
        {!list.isLoading && (list.data || []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground col-span-2">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Nenhuma regra de IA criada. Crie sua primeira regra inteligente.
          </Card>
        )}
      </div>

      {editing && (
        <RuleEditor rule={editing} onClose={() => setEditing(null)} onSave={(r) => { upsert.mutate(r); setEditing(null); }} />
      )}
    </div>
  );
}

function RuleEditor({ rule, onClose, onSave }: { rule: Partial<AIAutoreplyRule>; onClose: () => void; onSave: (r: Partial<AIAutoreplyRule>) => void }) {
  const [draft, setDraft] = useState<Partial<AIAutoreplyRule>>(rule);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar regra de IA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={draft.model || 'google/gemini-2.5-flash'} onValueChange={(v) => setDraft({ ...draft, model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Prompt do sistema (instruções para a IA)</Label>
            <Textarea rows={4} value={draft.system_prompt || ''} onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })} placeholder="Como a IA deve se comportar..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intenções (separadas por vírgula)</Label>
              <Input
                value={(draft.match_intents || []).join(', ')}
                onChange={(e) => setDraft({ ...draft, match_intents: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="duvida, suporte, preco"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Palavras-chave</Label>
              <Input
                value={(draft.match_keywords || []).join(', ')}
                onChange={(e) => setDraft({ ...draft, match_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="quanto custa, horario, info"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Confiança mínima: {Math.round((draft.confidence_threshold ?? 0.6) * 100)}%</Label>
            <Slider value={[(draft.confidence_threshold ?? 0.6) * 100]} min={0} max={100} step={5} onValueChange={([v]) => setDraft({ ...draft, confidence_threshold: v / 100 })} />
            <p className="text-[11px] text-muted-foreground">Abaixo desse valor, a IA não responde e a conversa segue para humano.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Máx. respostas por conversa</Label>
              <Input type="number" min={1} max={20} value={draft.max_replies_per_conversation ?? 3} onChange={(e) => setDraft({ ...draft, max_replies_per_conversation: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <div className="flex items-center justify-between"><Label className="text-xs">Usar Base de Conhecimento</Label><Switch checked={draft.use_knowledge_base ?? true} onCheckedChange={(v) => setDraft({ ...draft, use_knowledge_base: v })} /></div>
              <div className="flex items-center justify-between"><Label className="text-xs">Handoff humano após máximo</Label><Switch checked={draft.handoff_after_max ?? true} onCheckedChange={(v) => setDraft({ ...draft, handoff_after_max: v })} /></div>
              <div className="flex items-center justify-between"><Label className="text-xs">Apenas horário comercial</Label><Switch checked={draft.only_business_hours ?? false} onCheckedChange={(v) => setDraft({ ...draft, only_business_hours: v })} /></div>
              <div className="flex items-center justify-between"><Label className="text-xs">Regra ativa</Label><Switch checked={draft.is_active ?? false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} /></div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(draft)}>Salvar regra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
