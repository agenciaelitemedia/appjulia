import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Key, Plus, Trash2, Copy, Check, Code2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useChatApiKeys,
  useCreateChatApiKey,
  useToggleChatApiKey,
  useDeleteChatApiKey,
} from '@/hooks/useChatApiKeys';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ALL_SCOPES = [
  { value: 'conversations:read', label: 'Ler conversas' },
  { value: 'conversations:write', label: 'Atualizar conversas (status, prioridade, tags)' },
  { value: 'messages:write', label: 'Enviar mensagens' },
];

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat-public-api`;

export default function ChatApiKeysPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = String(user?.id ?? '');
  const { data: keys = [], isLoading } = useChatApiKeys(clientId);
  const create = useCreateChatApiKey();
  const toggle = useToggleChatApiKey();
  const remove = useDeleteChatApiKey();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(ALL_SCOPES.map(s => s.value));
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Informe um nome');
    const res = await create.mutateAsync({ clientId, name: name.trim(), scopes });
    setOpen(false);
    setName('');
    setRevealed({ name: res.row.name, key: res.plainKey });
  };

  const copyKey = (k: string) => {
    navigator.clipboard.writeText(k);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Copiado');
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> API Keys
          </h2>
          <p className="text-muted-foreground text-sm">Gere chaves para acessar a API pública de conversas</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova chave
        </Button>
      </div>

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <Code2 className="h-4 w-4 text-blue-500" /> Endpoint base
          </div>
          <code className="block bg-background/60 p-2 rounded text-xs font-mono break-all">
            {API_BASE}
          </code>
          <p className="text-muted-foreground text-xs">
            Use o header <code className="text-foreground">X-API-Key: cak_...</code>. Endpoints disponíveis:
            <code className="ml-1">GET /conversations</code>,
            <code className="ml-1">GET /conversations/:id</code>,
            <code className="ml-1">PATCH /conversations/:id</code>,
            <code className="ml-1">GET /conversations/:id/messages</code>,
            <code className="ml-1">POST /conversations/:id/messages</code>.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Carregando…</div>
        ) : keys.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma chave criada</CardContent></Card>
        ) : (
          keys.map(k => (
            <Card key={k.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{k.name}</span>
                    {!k.is_active && <Badge variant="secondary">Inativa</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {k.key_prefix}••••••••
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {k.scopes.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Criada {format(new Date(k.created_at), 'dd/MM/yyyy')}
                    {k.last_used_at && ` · Último uso ${format(new Date(k.last_used_at), 'dd/MM HH:mm')}`}
                  </div>
                </div>
                <Switch
                  checked={k.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: k.id, is_active: v })}
                />
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm(`Remover "${k.name}"?`)) remove.mutate(k.id);
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>Defina nome e permissões da chave</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Integração com CRM" />
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              {ALL_SCOPES.map(s => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(s.value)}
                    onCheckedChange={(v) => setScopes(p => v ? [...p, s.value] : p.filter(x => x !== s.value))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog */}
      <Dialog open={!!revealed} onOpenChange={(v) => !v && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave gerada</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              Copie agora — esta é a única vez que ela será mostrada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{revealed?.name}</Label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-xs font-mono break-all">
                {revealed?.key}
              </code>
              <Button size="icon" variant="outline" onClick={() => revealed && copyKey(revealed.key)}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
