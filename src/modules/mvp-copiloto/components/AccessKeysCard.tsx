/**
 * Chaves de acesso do conector MCP: alternativa ao OAuth para clientes que
 * aceitam um header Authorization fixo (OpenClaw, Claude, Cursor).
 * A chave é vinculada ao escritório no servidor, é somente leitura e revogável.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';
import { createAccessKey, MCP_URL, OAUTH_BASE } from '../lib/copilotoApi';

interface KeyRow {
  id: string;
  client_name: string | null;
  scope: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export function AccessKeysCard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const queryClient = useQueryClient();

  const [label, setLabel] = useState('OpenClaw');
  const [days, setDays] = useState('90');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys } = useQuery<KeyRow[]>({
    queryKey: ['copiloto', 'keys', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cop_oauth_tokens')
        .select('id, client_name, scope, created_at, expires_at, last_used_at')
        .eq('julia_client_id', clientId)
        .eq('kind', 'key')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as KeyRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['copiloto', 'keys', clientId] });

  const generate = async () => {
    if (!password) {
      toast.error('Informe sua senha da Julia.');
      return;
    }
    setCreating(true);
    try {
      const token = await createAccessKey(user?.email || '', password, label, Number(days));
      setNewKey(token);
      setPassword('');
      invalidate();
      toast.success('Chave gerada. Copie agora — ela não será exibida novamente.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revogar esta chave? O cliente conectado perde o acesso imediatamente.')) return;
    const pass = prompt('Confirme sua senha da Julia para revogar:') || '';
    if (!pass) return;
    try {
      const res = await fetch(`${OAUTH_BASE}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: id, email: user?.email, password: pass }),
      });
      if (!res.ok) throw new Error('Senha inválida ou falha ao revogar.');
      toast.success('Chave revogada.');
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copy = (value: string, what: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${what} copiado`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Chaves de acesso (conexão direta)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Se o cliente MCP não concluir o login OAuth, use uma chave: configure o servidor remoto com o header{' '}
          <code>Authorization: Bearer &lt;chave&gt;</code>. O escritório fica gravado na chave, o acesso é somente
          leitura e você revoga quando quiser.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="key-label">Nome</Label>
            <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Validade</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="365">365 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="key-pass">Sua senha</Label>
            <Input
              id="key-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={generate} disabled={creating}>
          {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Gerar chave
        </Button>

        {newKey && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">Copie agora — não será exibida novamente:</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={newKey} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copy(newKey, 'Chave')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${MCP_URL}  |  Authorization: Bearer ${newKey}`}
                className="font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copy(`Authorization: Bearer ${newKey}`, 'Header')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="font-medium">Chaves ativas</div>
          {!keys?.length ? (
            <p className="text-xs text-muted-foreground">Nenhuma chave gerada.</p>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{k.client_name || 'Chave'}</div>
                  <div className="text-xs text-muted-foreground">
                    criada {new Date(k.created_at).toLocaleDateString('pt-BR')} · expira{' '}
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString('pt-BR') : '—'} · último uso{' '}
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString('pt-BR') : 'nunca'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">somente leitura</Badge>
                  <Button size="icon" variant="ghost" onClick={() => revoke(k.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
