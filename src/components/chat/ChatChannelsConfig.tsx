import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Instagram, Copy, Check, Code, Palette, Settings2, Eye } from 'lucide-react';
import { WebChatWidgetPreview } from './WebChatWidgetPreview';

export function ChatChannelsConfig() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('webchat');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Canais de Atendimento</h2>
        <p className="text-muted-foreground">Configure os canais de entrada para o chat omnichannel</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webchat" className="gap-2">
            <Globe className="h-4 w-4" />
            WebChat
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="h-4 w-4" />
            Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webchat">
          <WebChatConfigPanel />
        </TabsContent>
        <TabsContent value="instagram">
          <InstagramConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// WebChat Configuration Panel
// ============================================

function WebChatConfigPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState({
    is_active: false,
    widget_title: 'Chat conosco',
    welcome_message: 'Olá! Como podemos ajudar?',
    primary_color: '#3b82f6',
    logo_url: '',
    position: 'bottom-right',
    collect_name: true,
    collect_email: true,
    offline_message: 'Estamos offline no momento. Deixe sua mensagem!',
    auto_open_delay_seconds: 0,
    allowed_domains: [] as string[],
  });
  const [domainsText, setDomainsText] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!user?.cod_agent) return;
    const { data } = await supabase
      .from('webchat_config')
      .select('*')
      .eq('cod_agent', String(user.cod_agent))
      .limit(1)
      .single();

    if (data) {
      setConfig({
        is_active: data.is_active,
        widget_title: data.widget_title,
        welcome_message: data.welcome_message || '',
        primary_color: data.primary_color,
        logo_url: data.logo_url || '',
        position: data.position,
        collect_name: data.collect_name ?? true,
        collect_email: data.collect_email ?? true,
        offline_message: data.offline_message || '',
        auto_open_delay_seconds: data.auto_open_delay_seconds || 0,
        allowed_domains: data.allowed_domains || [],
      });
      setDomainsText((data.allowed_domains || []).join('\n'));
    }
  };

  const saveConfig = async () => {
    if (!user?.cod_agent) return;
    setLoading(true);

    const domains = domainsText.split('\n').map(d => d.trim()).filter(Boolean);
    const payload = {
      ...config,
      cod_agent: String(user.cod_agent),
      client_id: String(user.id),
      allowed_domains: domains,
    };

    const { error } = await supabase
      .from('webchat_config')
      .upsert([payload] as any, { onConflict: 'cod_agent' });

    setLoading(false);
    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Configuração salva com sucesso');
    }
  };

  const embedCode = `<!-- Julia WebChat Widget -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${window.location.origin}/webchat-widget.js';
    s.setAttribute('data-agent', '${user?.cod_agent || 'SEU_COD_AGENT'}');
    s.setAttribute('data-client', '${user?.id || 'SEU_CLIENT_ID'}');
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Config form */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações do Widget
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="webchat-active" className="text-sm">Ativo</Label>
                <Switch
                  id="webchat-active"
                  checked={config.is_active}
                  onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Título do Widget</Label>
                <Input
                  value={config.widget_title}
                  onChange={(e) => setConfig({ ...config, widget_title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posição</Label>
                <Select value={config.position} onValueChange={(v) => setConfig({ ...config, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Inferior Direito</SelectItem>
                    <SelectItem value="bottom-left">Inferior Esquerdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mensagem de boas-vindas</Label>
              <Textarea
                value={config.welcome_message}
                onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cor principal</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL do Logo</Label>
                <Input
                  value={config.logo_url}
                  onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.collect_name}
                  onCheckedChange={(v) => setConfig({ ...config, collect_name: v })}
                />
                <Label className="text-xs">Coletar nome</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.collect_email}
                  onCheckedChange={(v) => setConfig({ ...config, collect_email: v })}
                />
                <Label className="text-xs">Coletar email</Label>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mensagem offline</Label>
              <Input
                value={config.offline_message}
                onChange={(e) => setConfig({ ...config, offline_message: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Domínios permitidos (um por linha, vazio = todos)</Label>
              <Textarea
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                rows={2}
                placeholder="exemplo.com.br&#10;meusite.com"
              />
            </div>

            <Button onClick={saveConfig} disabled={loading} className="w-full">
              {loading ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </CardContent>
        </Card>

        {/* Embed code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5" />
              Código de Incorporação
            </CardTitle>
            <CardDescription>Adicione este código ao seu site para exibir o widget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {embedCode}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview do Widget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WebChatWidgetPreview config={config} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Instagram Configuration Panel
// ============================================

function InstagramConfigPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    is_active: false,
    instagram_page_id: '',
    instagram_user_id: '',
    page_access_token: '',
    page_name: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!user?.cod_agent) return;
    const { data } = await supabase
      .from('instagram_config')
      .select('*')
      .eq('cod_agent', user.cod_agent)
      .limit(1)
      .single();

    if (data) {
      setConfig({
        is_active: data.is_active,
        instagram_page_id: data.instagram_page_id || '',
        instagram_user_id: data.instagram_user_id || '',
        page_access_token: data.page_access_token || '',
        page_name: data.page_name || '',
      });
    }
  };

  const saveConfig = async () => {
    if (!user?.cod_agent) return;
    setLoading(true);

    const { error } = await supabase
      .from('instagram_config')
      .upsert({
        ...config,
        cod_agent: user.cod_agent,
        client_id: String(user.id),
      }, { onConflict: 'cod_agent' });

    setLoading(false);
    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Configuração salva');
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/instagram-webhook`;

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              Configuração do Instagram
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="ig-active" className="text-sm">Ativo</Label>
              <Switch
                id="ig-active"
                checked={config.is_active}
                onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
              />
            </div>
          </div>
          <CardDescription>
            Configure a integração com Instagram Messaging via Meta Graph API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Pré-requisitos:</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Ter uma Página do Facebook vinculada ao perfil do Instagram</li>
              <li>Criar um App no Meta for Developers com permissão Instagram Messaging</li>
              <li>Gerar o Page Access Token com as permissões: <code>instagram_manage_messages</code>, <code>pages_messaging</code></li>
              <li>Configurar o Webhook abaixo no Meta Developer Console</li>
            </ol>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">URL do Webhook (cole no Meta Developer Console)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="text-xs font-mono" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success('URL copiada!');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Page ID (Facebook)</Label>
              <Input
                value={config.instagram_page_id}
                onChange={(e) => setConfig({ ...config, instagram_page_id: e.target.value })}
                placeholder="Ex: 123456789"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instagram User ID</Label>
              <Input
                value={config.instagram_user_id}
                onChange={(e) => setConfig({ ...config, instagram_user_id: e.target.value })}
                placeholder="Ex: 17841400..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nome da Página</Label>
            <Input
              value={config.page_name}
              onChange={(e) => setConfig({ ...config, page_name: e.target.value })}
              placeholder="Nome do seu perfil/página"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Page Access Token</Label>
            <Textarea
              value={config.page_access_token}
              onChange={(e) => setConfig({ ...config, page_access_token: e.target.value })}
              placeholder="EAAxxxxxxxxx..."
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={saveConfig} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Salvar Configuração Instagram'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
