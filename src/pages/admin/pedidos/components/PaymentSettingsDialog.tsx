import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentConfig {
  id?: string;
  gateway: string;
  is_active: boolean;
  is_sandbox: boolean;
  config: Record<string, string>;
}

export const PaymentSettingsDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ipConfig, setIpConfig] = useState<PaymentConfig>({
    gateway: 'infinitypay',
    is_active: true,
    is_sandbox: false,
    config: { handle: 'atendejulia-masterchat' },
  });

  const [mpConfig, setMpConfig] = useState<PaymentConfig>({
    gateway: 'mercadopago',
    is_active: false,
    is_sandbox: true,
    config: { access_token: '', public_key: '', site_url: '' },
  });

  const [asConfig, setAsConfig] = useState<PaymentConfig>({
    gateway: 'asaas',
    is_active: false,
    is_sandbox: true,
    config: { api_key: '' },
  });

  const [configuringWebhook, setConfiguringWebhook] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('julia_payment_config')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const ip = data.find((c: any) => c.gateway === 'infinitypay');
          const mp = data.find((c: any) => c.gateway === 'mercadopago');
          const as_ = data.find((c: any) => c.gateway === 'asaas');
          if (ip) setIpConfig({ ...ip, config: (ip.config || {}) as Record<string, string> });
          if (mp) setMpConfig({ ...mp, config: (mp.config || {}) as Record<string, string> });
          if (as_) setAsConfig({ ...as_, config: (as_.config || {}) as Record<string, string> });
        }
        setLoading(false);
      });
  }, [open]);

  const saveConfig = async (cfg: PaymentConfig) => {
    const payload = {
      gateway: cfg.gateway,
      is_active: cfg.is_active,
      is_sandbox: cfg.is_sandbox,
      config: cfg.config,
      updated_at: new Date().toISOString(),
    };

    if (cfg.id) {
      const { error } = await supabase
        .from('julia_payment_config')
        .update(payload)
        .eq('id', cfg.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('julia_payment_config')
        .insert(payload);
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(ipConfig);
      await saveConfig(mpConfig);
      await saveConfig(asConfig);

      // Auto-configure Asaas webhook if api_key is set
      if (asConfig.config.api_key) {
        setConfiguringWebhook(true);
        try {
          const { data, error: fnErr } = await supabase.functions.invoke('asaas-configure-webhook', {
            body: { api_key: asConfig.config.api_key, is_sandbox: asConfig.is_sandbox },
          });
          if (fnErr) {
            console.warn('Webhook config failed:', fnErr);
            toast.warning('Configurações salvas, mas falha ao registrar webhook no Asaas.');
          } else {
            console.log('Asaas webhook configured:', data);
          }
        } catch (whErr) {
          console.warn('Webhook config error:', whErr);
        } finally {
          setConfiguringWebhook(false);
        }
      }

      toast.success('Configurações salvas');
      setOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurações de Pagamento</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="gateways" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="gateways" className="flex-1">Métodos de Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Configurações gerais dos pedidos da Julia. Os métodos de pagamento são configurados na aba ao lado.
              </p>
            </TabsContent>

            <TabsContent value="gateways" className="space-y-6 pt-4">
              {/* InfinityPay */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">InfinityPay</h3>
                    <p className="text-xs text-muted-foreground">Gateway de pagamento atual</p>
                  </div>
                  <Switch
                    checked={ipConfig.is_active}
                    onCheckedChange={(v) => setIpConfig(prev => ({ ...prev, is_active: v }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Handle</Label>
                  <Input
                    value={ipConfig.config.handle || ''}
                    onChange={(e) => setIpConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, handle: e.target.value },
                    }))}
                    placeholder="@handle"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Mercado Pago */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Mercado Pago</h3>
                    <p className="text-xs text-muted-foreground">Checkout Pro com redirecionamento</p>
                  </div>
                  <Switch
                    checked={mpConfig.is_active}
                    onCheckedChange={(v) => setMpConfig(prev => ({ ...prev, is_active: v }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={mpConfig.is_sandbox}
                    onCheckedChange={(v) => setMpConfig(prev => ({ ...prev, is_sandbox: v }))}
                  />
                  <Label className="text-xs">Modo Sandbox (testes)</Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Access Token</Label>
                  <Input
                    type="password"
                    value={mpConfig.config.access_token || ''}
                    onChange={(e) => setMpConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, access_token: e.target.value },
                    }))}
                    placeholder="APP_USR-..."
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Mercado Pago → Seu negócio → Configurações → Credenciais
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Public Key</Label>
                  <Input
                    value={mpConfig.config.public_key || ''}
                    onChange={(e) => setMpConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, public_key: e.target.value },
                    }))}
                    placeholder="APP_USR-..."
                    className="text-sm font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">URL do Site (para back_urls)</Label>
                  <Input
                    value={mpConfig.config.site_url || ''}
                    onChange={(e) => setMpConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, site_url: e.target.value },
                    }))}
                    placeholder="https://appjulia.lovable.app"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Asaas */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Asaas</h3>
                    <p className="text-xs text-muted-foreground">Cartão de crédito com parcelamento até 12x</p>
                  </div>
                  <Switch
                    checked={asConfig.is_active}
                    onCheckedChange={(v) => setAsConfig(prev => ({ ...prev, is_active: v }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={asConfig.is_sandbox}
                    onCheckedChange={(v) => setAsConfig(prev => ({ ...prev, is_sandbox: v }))}
                  />
                  <Label className="text-xs">Modo Sandbox (testes)</Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={asConfig.config.api_key || ''}
                    onChange={(e) => setAsConfig(prev => ({
                      ...prev,
                      config: { ...prev.config, api_key: e.target.value },
                    }))}
                    placeholder="$aact_..."
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Asaas → Configurações → Integrações → API Key
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Webhook URL (automático)</Label>
                  <Input
                    value="https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/asaas-webhook"
                    readOnly
                    className="text-sm font-mono bg-muted cursor-default"
                  />
                  <p className="text-xs text-muted-foreground">
                    O webhook é configurado automaticamente ao salvar.
                  </p>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving || configuringWebhook} className="w-full">
                {(saving || configuringWebhook) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {configuringWebhook ? 'Configurando webhook...' : 'Salvar Configurações'}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
