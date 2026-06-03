import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Eye, EyeOff, Loader2, Plus, Save, Search, Trash2, Pencil, Webhook, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { useClientSearch, type SearchedClient } from '../hooks/useClientSearch';
import { useTelephonyProviders, type TelephonyProvider } from '../hooks/useTelephonyProviders';
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
  const { searchTerm, setSearchTerm, results: clientResults, isLoading: clientSearching } = useClientSearch();
  const { data: providerOptions = [] } = useTelephonyProviders();

  const [editing, setEditing] = useState<PhoneConfig | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [selectedClient, setSelectedClient] = useState<SearchedClient | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderType>('api4com');
  // api4com fields
  const [domain, setDomain] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [token, setToken] = useState('');
  // 3cplus fields
  const [threecToken, setThreecToken] = useState('');
  const [threecBaseUrl, setThreecBaseUrl] = useState('https://app.3c.fluxoti.com/api/v1');
  const [threecWsUrl, setThreecWsUrl] = useState('');

  const [showToken, setShowToken] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());

  const webhookUrl = getWebhookUrl(provider);

  const handleCopyUrl = (url?: string) => {
    navigator.clipboard.writeText(url || webhookUrl);
    toast.success('URL copiada');
  };

  const resetForm = () => {
    setSelectedClient(null);
    setSearchTerm('');
    setSelectedProviderId(null);
    setProvider('api4com');
    setDomain('');
    setSipDomain('');
    setToken('');
    setThreecToken('');
    setThreecBaseUrl('https://app.3c.fluxoti.com/api/v1');
    setThreecWsUrl('');
    setShowToken(false);
    setEditing(null);
    setIsAdding(false);
  };

  const openAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (cfg: PhoneConfig) => {
    // For editing, build a synthetic client from the config row
    if (cfg.client_id != null) {
      setSelectedClient({
        id: Number(cfg.client_id),
        name: (cfg as any).client_name || '',
        business_name: (cfg as any).business_name ?? null,
        email: null,
        phone: null,
      });
    } else {
      setSelectedClient(null);
    }
    setSelectedProviderId(cfg.provider_id ?? null);
    setProvider(cfg.provider || 'api4com');
    setDomain(cfg.api4com_domain || '');
    setSipDomain(cfg.sip_domain || '');
    setToken(cfg.api4com_token || '');
    setThreecToken(cfg.threecplus_token || '');
    setThreecBaseUrl(cfg.threecplus_base_url || 'https://app.3c.fluxoti.com/api/v1');
    setThreecWsUrl(cfg.threecplus_ws_url || '');
    setShowToken(false);
    setEditing(cfg);
    setIsAdding(true);
  };

  const handleSelectProvider = (id: string) => {
    const p = providerOptions.find((x) => x.id === id);
    if (!p) return;
    setSelectedProviderId(id);
    setProvider(p.provider);
    if (p.provider === '3cplus') {
      setThreecToken(p.threecplus_token || '');
      setThreecBaseUrl(p.threecplus_base_url || 'https://app.3c.fluxoti.com/api/v1');
      setThreecWsUrl(p.threecplus_ws_url || '');
      setSipDomain(p.sip_domain || '');
    } else {
      setDomain(p.api4com_domain || '');
      setToken(p.api4com_token || '');
      setSipDomain(p.sip_domain || '');
    }
  };

  const isFormValid = () => {
    if (!selectedClient) return false;
    if (!selectedProviderId) return false;
    if (provider === '3cplus') return !!threecToken;
    return !!(domain && token);
  };

  const handleSave = () => {
    if (!isFormValid() || !selectedClient) return;
    const payload: any = {
      ...(editing ? { id: editing.id } : {}),
      client_id: selectedClient.id,
      provider,
      provider_id: selectedProviderId,
    };
    if (provider === '3cplus') {
      payload.threecplus_token = threecToken;
      payload.threecplus_base_url = threecBaseUrl || 'https://app.3c.fluxoti.com/api/v1';
      payload.threecplus_ws_url = threecWsUrl || null;
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
          <CardTitle className="text-lg">Configurações por Cliente</CardTitle>
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

                {/* Client picker (or display when editing) */}
                {editing ? (
                  <div className="p-3 border rounded-md bg-muted/30">
                    <Label className="text-xs">Cliente</Label>
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        #{selectedClient?.id ?? '—'}
                      </span>
                      <span className="block text-sm font-medium">
                        {selectedClient?.name || '(sem nome)'}
                      </span>
                      {selectedClient?.business_name && (
                        <span className="block text-xs text-muted-foreground">
                          {selectedClient.business_name}
                        </span>
                      )}
                    </div>
                  </div>
                ) : !selectedClient ? (
                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Nome, escritório ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    {clientSearching && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                      </div>
                    )}
                    {clientResults.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                            onClick={() => setSelectedClient(c)}
                          >
                            <span className="font-mono text-xs text-muted-foreground">#{c.id}</span>
                            <span className="block text-sm font-medium">{c.name}</span>
                            {c.business_name && (
                              <span className="block text-xs text-muted-foreground">{c.business_name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 border rounded-md bg-muted/30 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">Cliente #{selectedClient.id}</span>
                      <span className="block text-sm font-medium">{selectedClient.name}</span>
                      {selectedClient.business_name && (
                        <span className="block text-xs text-muted-foreground">{selectedClient.business_name}</span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>Trocar</Button>
                  </div>
                )}

                <div>
                  <Label>Provedor</Label>
                    <Select value={selectedProviderId ?? ''} onValueChange={handleSelectProvider}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um provedor cadastrado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Nenhum provedor cadastrado. Adicione um na aba "Provedores".
                          </div>
                        ) : (
                          providerOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} <span className="text-xs text-muted-foreground">· {PROVIDER_LABELS[p.provider]}</span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Os campos abaixo são pré-preenchidos a partir do provedor selecionado. Você pode editá-los para criar overrides por cliente.
                    </p>
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
                      <Label>URL Base API (Tenant)</Label>
                      <Input value={threecBaseUrl} onChange={(e) => setThreecBaseUrl(e.target.value)} placeholder="https://assessoria.3c.fluxoti.com/api/v1" />
                      <p className="text-xs text-muted-foreground mt-1">URL da API REST do seu tenant 3C+ (ex: https://assessoria.3c.fluxoti.com/api/v1)</p>
                    </div>
                    <div>
                      <Label>Domínio SIP/PBX (override)</Label>
                      <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="Deixe vazio para usar o retornado pelo 3C+" />
                      <p className="text-xs text-muted-foreground mt-1">Override manual do domínio SIP. Se vazio, usa o domínio retornado pelo login do webphone.</p>
                    </div>
                    <div className="col-span-2">
                      <Label>URL WebSocket SIP (override)</Label>
                      <Input value={threecWsUrl} onChange={(e) => setThreecWsUrl(e.target.value)} placeholder="Deixe vazio para derivar do domínio SIP" />
                      <p className="text-xs text-muted-foreground mt-1">Override manual do WSS. Se vazio, usa wss://{'{domínio SIP}'}:8089/ws. Tenant ≠ PBX: assessoria.3c.fluxoti.com é API, não SIP.</p>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Domínio / URL</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg) => (
                  <TableRow key={cfg.id}>
                    <TableCell>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {cfg.client_id != null ? `#${cfg.client_id}` : '#—'}
                        </span>
                        <span className="block text-sm font-medium">
                          {(cfg as any).client_name || '(sem nome)'}
                        </span>
                        {(cfg as any).business_name && (
                          <span className="block text-xs text-muted-foreground">
                            {(cfg as any).business_name}
                          </span>
                        )}
                        {cfg.cod_agent && (
                          <span className="block text-[10px] text-muted-foreground/70 font-mono">
                            cod_agent: {cfg.cod_agent}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.provider === '3cplus' ? 'default' : 'secondary'} className="text-xs">
                        {(cfg as any).provider_name || PROVIDER_LABELS[cfg.provider] || cfg.provider}
                      </Badge>
                      {(cfg as any).provider_name && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {PROVIDER_LABELS[cfg.provider]}
                        </div>
                      )}
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
                                A configuração do cliente <strong>
                                  #{cfg.client_id ?? '—'} {(cfg as any).client_name ?? ''}
                                </strong> será removida permanentemente.
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
