import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, Save, Webhook } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { toast } from 'sonner';

export function ConfigTab() {
  const { configs, configsLoading, saveConfig, setupWebhook } = useTelefoniaAdmin();
  const [codAgent, setCodAgent] = useState('');
  const [domain, setDomain] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [token, setToken] = useState('');

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api4com-webhook`;

  const handleSave = () => {
    if (!codAgent || !domain || !token) return;
    saveConfig.mutate({ cod_agent: codAgent, api4com_domain: domain, api4com_token: token, sip_domain: sipDomain || undefined });
    setCodAgent('');
    setDomain('');
    setSipDomain('');
    setToken('');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada');
  };

  return (
    <div className="space-y-6">
      {/* Webhook Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5" /> Webhook Api4Com
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">URL do Webhook (cole no painel Api4Com ou configure automaticamente)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyUrl} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Eventos capturados: <strong>channel-create</strong>, <strong>channel-answer</strong>, <strong>channel-hangup</strong>
          </p>
          {configs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {configs.filter(c => c.is_active).map(c => (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setupWebhook.mutate(c.cod_agent)}
                  disabled={setupWebhook.isPending}
                >
                  <Webhook className="h-3.5 w-3.5 mr-1" />
                  Configurar webhook — {c.cod_agent}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração Api4Com</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Cód. Agente</Label>
              <Input value={codAgent} onChange={(e) => setCodAgent(e.target.value)} placeholder="202601001" />
            </div>
            <div>
              <Label>Domínio Api4Com</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.api4com.com" />
            </div>
            <div>
              <Label>Token</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Token de acesso" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saveConfig.isPending || !codAgent || !domain || !token}>
            <Save className="h-4 w-4 mr-1" /> Salvar Configuração
          </Button>

          {configsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.cod_agent}</TableCell>
                    <TableCell>{c.api4com_domain}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
