import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bot, Plus, Trash2, Pencil } from 'lucide-react';
import { useChatBots, type ChatBot } from '@/hooks/useChatBots';

export default function ChatBotsPage() {
  const { bots, loading, upsert, remove, toggle } = useChatBots();
  const [editing, setEditing] = useState<Partial<ChatBot> | null>(null);

  const blank: Partial<ChatBot> = {
    name: '', description: '', is_active: true, trigger_type: 'keyword',
    trigger_keywords: [], match_mode: 'contains', response_text: '',
    handoff_to_human: false, only_business_hours: false, position: bots.length,
  };

  const save = async () => {
    if (!editing?.name || !editing?.response_text) return;
    const ok = await upsert(editing);
    if (ok) setEditing(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Chatbots
          </h1>
          <p className="text-sm text-muted-foreground">Respostas automáticas por palavra-chave.</p>
        </div>
        <Button onClick={() => setEditing(blank)}>
          <Plus className="h-4 w-4 mr-1" /> Novo bot
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : bots.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum bot. Clique em "Novo bot" para criar o primeiro.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {bots.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={b.is_active} onCheckedChange={(v) => toggle(b.id, v)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    <Badge variant="outline" className="text-[10px]">{b.trigger_type}</Badge>
                    {b.handoff_to_human && <Badge className="text-[10px]">handoff</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{b.response_text}</p>
                  {b.trigger_keywords.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Gatilhos: {b.trigger_keywords.join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{b.execution_count} execuções</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar bot' : 'Novo bot'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de gatilho</Label>
                  <Select value={editing.trigger_type} onValueChange={(v: any) => setEditing({ ...editing, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Palavra-chave</SelectItem>
                      <SelectItem value="first_message">Primeira mensagem</SelectItem>
                      <SelectItem value="any">Qualquer mensagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modo de comparação</Label>
                  <Select value={editing.match_mode} onValueChange={(v: any) => setEditing({ ...editing, match_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="exact">Exato</SelectItem>
                      <SelectItem value="starts_with">Começa com</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Palavras-chave (separe por vírgula)</Label>
                <Input
                  value={(editing.trigger_keywords || []).join(', ')}
                  onChange={(e) => setEditing({ ...editing, trigger_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="oi, olá, bom dia"
                />
              </div>
              <div>
                <Label>Resposta automática</Label>
                <Textarea rows={4} value={editing.response_text || ''} onChange={(e) => setEditing({ ...editing, response_text: e.target.value })} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.handoff_to_human} onCheckedChange={(v) => setEditing({ ...editing, handoff_to_human: v })} />
                  Encaminhar para humano após resposta
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.only_business_hours} onCheckedChange={(v) => setEditing({ ...editing, only_business_hours: v })} />
                  Apenas em horário comercial
                </label>
              </div>
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
