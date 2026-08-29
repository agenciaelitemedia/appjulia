/**
 * Cartão de conexão do Copiloto: mostra a URL do conector MCP da Julia
 * e as conexões (tokens) ativas do escritório, com opção de revogar.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Copy, Plug, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useAuth } from '../extend/auth';
import { MCP_URL, OAUTH_BASE } from '../lib/copilotoApi';



interface TokenRow {
  id: string;
  client_name: string | null;
  scope: string;
  kind: string;
  last_used_at: string | null;
  created_at: string;
}

export function McpConnectionCard() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);


  const { data: tokens } = useQuery<TokenRow[]>({
    queryKey: ['copiloto', 'tokens', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cop_oauth_tokens')
        .select('id, client_name, scope, kind, last_used_at, created_at')
        .eq('julia_client_id', clientId)
        .eq('kind', 'connector')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TokenRow[];
    },
  });

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiada`);
  };

  const revoke = async (tokenId: string) => {
    if (!password) {
      toast.error('Informe sua senha para revogar a conexão.');
      return;
    }
    setRevoking(tokenId);
    try {
      const res = await fetch(`${OAUTH_BASE}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, email: user?.email, password }),
      });
      if (!res.ok) throw new Error('Senha inválida ou falha ao revogar.');
      toast.success('Conexão revogada.');
      queryClient.invalidateQueries({ queryKey: ['copiloto', 'tokens', clientId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          Conector oficial (MCP)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Caminho permitido pelas plataformas: a Julia expõe um conector MCP e você o adiciona no ChatGPT
          (Connectors / Developer mode) ou no Claude (Custom Connectors). A autorização usa OAuth com PKCE e o
          escritório é resolvido no servidor — nenhum cookie ou sessão de terceiros é utilizado.
        </p>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            URL do servidor MCP
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value={MCP_URL} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => copy(MCP_URL, 'URL do conector')}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Endereço oficial no domínio da Julia — cole essa URL no cliente MCP. Ao conectar, ele descobre
            sozinho o OAuth, você faz login na Julia e aprova o acesso de leitura (escopos{' '}
            <code>leads:read</code> e <code>julia:read</code>). Não é preciso chave nem header manual.
          </p>

        </div>



        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Conexões ativas
          </div>
          {!tokens?.length ? (
            <p className="text-xs text-muted-foreground">Nenhum aplicativo conectado a este escritório.</p>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Sua senha (para revogar)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="max-w-xs"
              />
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.client_name || 'Aplicativo MCP'}</div>
                    <div className="text-xs text-muted-foreground">
                      criado {new Date(t.created_at).toLocaleString('pt-BR')} · último uso{' '}
                      {t.last_used_at ? new Date(t.last_used_at).toLocaleString('pt-BR') : 'nunca'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t.scope}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={revoking === t.id}
                      onClick={() => revoke(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
