import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Save, Webhook } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { toast } from 'sonner';

export function ConfigTab() {
  const { config, configLoading, saveConfig } = useTelefoniaAdmin();
  const [codAgent, setCodAgent] = useState('');
  const [domain, setDomain] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [token, setToken] = useState('');

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api4com-webhook`;

  // Load existing config into form
  useEffect(() => {
    if (config) {
      setCodAgent(config.cod_agent);
      setDomain(config.api4com_domain);
      setSipDomain(config.sip_domain || '');
      setToken(config.api4com_token);
    }
  }, [config]);

  const handleSave = () => {
    if (!codAgent || !domain || !token) return;
    saveConfig.mutate({
      ...(config ? { id: config.id } : {}),
      cod_agent: codAgent,
      api4com_domain: domain,
      api4com_token: token,
      sip_domain: sipDomain || undefined,
    } as any);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada');
  };

  if (configLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Webhook Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5" /> Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">URL do Webhook (configure manualmente no painel do provedor)</Label>
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
        </CardContent>
      </Card>

      {/* Config Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do Provedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cód. Agente</Label>
              <Input value={codAgent} onChange={(e) => setCodAgent(e.target.value)} placeholder="202601001" />
            </div>
            <div>
              <Label>Domínio API (REST)</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.provedor.com" />
            </div>
            <div>
              <Label>Domínio SIP (WebRTC)</Label>
              <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="seudominio.provedor.com" />
            </div>
            <div>
              <Label>Token</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Token de acesso" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saveConfig.isPending || !codAgent || !domain || !token}>
            <Save className="h-4 w-4 mr-1" /> {config ? 'Atualizar' : 'Salvar'} Configuração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
