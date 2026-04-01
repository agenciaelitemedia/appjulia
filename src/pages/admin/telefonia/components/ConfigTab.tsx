import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Eye, EyeOff, Plus, Save, Trash2, Pencil, Webhook, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { toast } from 'sonner';
import type { PhoneConfig, ProviderType } from '../types';
import { PROVIDER_LABELS } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function getWebhookUrl(provider: ProviderType) {
  return provider === '3cplus'
    ? `${SUPABASE_URL}/functions/v1/threecplus-webhook`
    : `${SUPABASE_URL}/functions/v1/api4com-webhook`;
}

export function ConfigTab() {
  const { configs, configsLoading, saveConfig, deleteConfig } = useTelefoniaAdmin();

  const [editing, setEditing] = useState<PhoneConfig | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [codAgent, setCodAgent] = useState('');
  const [provider, setProvider] = useState<ProviderType>('api4com');
  // api4com fields
  const [domain, setDomain] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [token, setToken] = useState('');
  // 3cplus fields
  const [threecToken, setThreecToken] = useState('');
  const [threecBaseUrl, setThreecBaseUrl] = useState('https://app.3c.fluxoti.com/api/v1');
  const [threecWsUrl, setThreecWsUrl] = useState('wss://events.3c.fluxoti.com/ws/me');

  const [showToken, setShowToken] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());

  const webhookUrl = getWebhookUrl(provider);

  const handleCopyUrl = (url?: string) => {
    navigator.clipboard.writeText(url || webhookUrl);
    toast.success('URL copiada');
  };

  const resetForm = () => {
    setCodAgent('');
    setProvider('api4com');
    setDomain('');
    setSipDomain('');
    setToken('');
    setThreecToken('');
    setThreecBaseUrl('https://app.3c.fluxoti.com/api/v1');
    setThreecWsUrl('wss://events.3c.fluxoti.com/ws/me');
    setShowToken(false);
    setEditing(null);
    setIsAdding(false);
  };

  const openAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (cfg: PhoneConfig) => {
    setCodAgent(cfg.cod_agent);
    setProvider(cfg.provider || 'api4com');
    setDomain(cfg.api4com_domain || '');
    setSipDomain(cfg.sip_domain || '');
    setToken(cfg.api4com_token || '');
    setThreecToken(cfg.threecplus_token || '');
    setThreecBaseUrl(cfg.threecplus_base_url || 'https://app.3c.fluxoti.com/api/v1');
    setThreecWsUrl(cfg.threecplus_ws_url || 'wss://events.3c.fluxoti.com/ws/me');
    setShowToken(false);
    setEditing(cfg);
    setIsAdding(true);
  };

  const isFormValid = () => {
    if (!codAgent) return false;
    if (provider === '3cplus') return !!threecToken;
    return !!(domain && token);
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    const payload: any = {
      ...(editing ? { id: editing.id } : {}),
      cod_agent: codAgent,
      provider,
    };
    if (provider === '3cplus') {
      payload.threecplus_token = threecToken;
      payload.threecplus_base_url = threecBaseUrl || 'https://app.3c.fluxoti.com/api/v1';
      payload.threecplus_ws_url = threecWsUrl || 'wss://events.3c.fluxoti.com/ws/me';
      payload.sip_domain = sipDomain || null;
      // Preserve empty api4com fields to avoid DB NOT NULL issues
      payload.api4com_domain = domain || '';
      payload.api4com_token = token || '';
    } else {
      payload.api4com_domain = domain;
      payload.api4com_token = token;
      payload.sip_domain = sipDomain || null;
    }
    saveConfig.mutate(payload, { onSuccess: resetForm });
  };

  const toggleRowToken = (id: number) => {
    setVisibleTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskToken = (t: string | null | undefined) => {
    if (!t) return '—';
    return t.length > 8 ? t.slice(0, 4) + '••••••••' + t.slice(-4) : '••••••••';
  };

  const getDisplayToken = (cfg: PhoneConfig) =>
    cfg.provider === '3cplus' ? cfg.threecplus_token : cfg.api4com_token;

  const getDisplayDomain = (cfg: PhoneConfig) =>
    cfg.provider === '3cplus'
      ? (cfg.threecplus_base_url || 'app.3c.fluxoti.com/api/v1')
      : (cfg.api4com_domain || '—');

  if (configsLoading) {
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
          <p className="text-xs text-muted-foreground">
            Configure a URL abaixo no painel do seu provedor de telefonia.
          </p>
          <div>
            <Label className="text-xs text-muted-foreground">Api4Com</Label>
            <div className="flex gap-2 mt-1">
              <Input value={getWebhookUrl('api4com')} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => handleCopyUrl(getWebhookUrl('api4com'))} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">3C+</Label>
            <div className="flex gap-2 mt-1">
              <Input value={getWebhookUrl('3cplus')} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => handleCopyUrl(getWebhookUrl('3cplus'))} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configs per agent */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Configurações por Agente</CardTitle>
          {!isAdding && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Nova Configuração
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add/Edit form */}
          {isAdding && (
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{editing ? 'Editar Configuração' : 'Nova Configuração'}</p>
                  <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cód. Agente</Label>
                    <Input value={codAgent} onChange={(e) => setCodAgent(e.target.value)} placeholder="202601001" disabled={!!editing} />
                  </div>
                  <div>
                    <Label>Provedor</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as ProviderType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api4com">Api4Com</SelectItem>
                        <SelectItem value="3cplus">3C+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Api4Com fields */}
                {provider === 'api4com' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Domínio API (REST)</Label>
                      <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.provedor.com" />
                    </div>
                    <div>
                      <Label>Domínio SIP (WebRTC)</Label>
                      <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="seudominio.provedor.com" />
                    </div>
                    <div className="col-span-2">
                      <Label>Token</Label>
                      <div className="flex gap-1">
                        <Input
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          type={showToken ? 'text' : 'password'}
                          placeholder="Token de acesso Api4Com"
                          className="flex-1"
                        />
                        <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)} type="button">
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3C+ fields */}
                {provider === '3cplus' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Token API 3C+</Label>
                      <div className="flex gap-1">
                        <Input
                          value={threecToken}
                          onChange={(e) => setThreecToken(e.target.value)}
                          type={showToken ? 'text' : 'password'}
                          placeholder="Token de acesso 3C+"
                          className="flex-1"
                        />
                        <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)} type="button">
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Domínio SIP (WebRTC)</Label>
                      <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="assessoria.3c.fluxoti.com" />
                      <p className="text-xs text-muted-foreground mt-1">Domínio SIP do PBX 3C+ (usado para conexão WebRTC)</p>
                    </div>
                    <div>
                      <Label>URL Base API</Label>
                      <Input value={threecBaseUrl} onChange={(e) => setThreecBaseUrl(e.target.value)} placeholder="https://app.3c.fluxoti.com/api/v1" />
                    </div>
                    <div className="col-span-2">
                      <Label>URL WebSocket de Eventos</Label>
                      <Input value={threecWsUrl} onChange={(e) => setThreecWsUrl(e.target.value)} placeholder="wss://events.3c.fluxoti.com/ws/me" />
                      <p className="text-xs text-muted-foreground mt-1">WebSocket de eventos da plataforma (não é o WebSocket SIP)</p>
                    </div>
                  </div>
                )}

                <Button onClick={handleSave} disabled={saveConfig.isPending || !isFormValid()}>
                  <Save className="h-4 w-4 mr-1" /> {editing ? 'Atualizar' : 'Salvar'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {configs.length === 0 && !isAdding ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma configuração cadastrada</p>
          ) : configs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. Agente</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Domínio / URL</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg) => (
                  <TableRow key={cfg.id}>
                    <TableCell className="font-mono text-xs">{cfg.cod_agent}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.provider === '3cplus' ? 'default' : 'secondary'} className="text-xs">
                        {PROVIDER_LABELS[cfg.provider] || cfg.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{getDisplayDomain(cfg)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {visibleTokens.has(cfg.id) ? (getDisplayToken(cfg) || '—') : maskToken(getDisplayToken(cfg))}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRowToken(cfg.id)}>
                          {visibleTokens.has(cfg.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cfg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A configuração do agente <strong>{cfg.cod_agent}</strong> será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteConfig.mutate(cfg.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
