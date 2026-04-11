import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useQueueProviderMutations, type QueueProvider } from '../hooks/useQueueProviders';

const providerTypeOptions = [
  { value: 'uazapi', label: 'UaZapi (WhatsApp)' },
  { value: 'waba', label: 'API Oficial Meta (WABA)' },
  { value: 'webchat', label: 'WebChat' },
  { value: 'instagram', label: 'Instagram' },
];

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: QueueProvider | null;
}

export function ProviderFormDialog({ open, onOpenChange, provider }: ProviderFormDialogProps) {
  const { createProvider, updateProvider } = useQueueProviderMutations();
  const isEditing = !!provider;

  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState('uazapi');
  // UaZapi
  const [evoUrl, setEvoUrl] = useState('');
  const [evoApikey, setEvoApikey] = useState('');
  // WABA
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [wabaBusinessId, setWabaBusinessId] = useState('');
  const [wabaToken, setWabaToken] = useState('');
  // Instagram
  const [instagramPageId, setInstagramPageId] = useState('');
  const [instagramUserId, setInstagramUserId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [pageName, setPageName] = useState('');

  useEffect(() => {
    if (provider) {
      setName(provider.name);
      setProviderType(provider.provider_type);
      setEvoUrl(provider.evo_url || '');
      setEvoApikey(provider.evo_apikey || '');
      setMetaAppId(provider.meta_app_id || '');
      setMetaAppSecret(provider.meta_app_secret || '');
      setWabaBusinessId(provider.waba_business_id || '');
      setWabaToken(provider.waba_token || '');
      setInstagramPageId(provider.instagram_page_id || '');
      setInstagramUserId(provider.instagram_user_id || '');
      setPageAccessToken(provider.page_access_token || '');
      setPageName(provider.page_name || '');
    } else {
      setName(''); setProviderType('uazapi');
      setEvoUrl(''); setEvoApikey('');
      setMetaAppId(''); setMetaAppSecret(''); setWabaBusinessId(''); setWabaToken('');
      setInstagramPageId(''); setInstagramUserId(''); setPageAccessToken(''); setPageName('');
    }
  }, [provider, open]);

  const isPending = createProvider.isPending || updateProvider.isPending;

  const handleSubmit = () => {
    if (!name.trim()) return;

    const data: Record<string, any> = {
      name: name.trim(),
      provider_type: providerType,
      is_active: true,
    };

    if (providerType === 'uazapi') {
      data.evo_url = evoUrl || null;
      data.evo_apikey = evoApikey || null;
    } else if (providerType === 'waba') {
      data.meta_app_id = metaAppId || null;
      data.meta_app_secret = metaAppSecret || null;
      data.waba_business_id = wabaBusinessId || null;
      data.waba_token = wabaToken || null;
    } else if (providerType === 'instagram') {
      data.instagram_page_id = instagramPageId || null;
      data.instagram_user_id = instagramUserId || null;
      data.page_access_token = pageAccessToken || null;
      data.page_name = pageName || null;
    }

    if (isEditing) {
      updateProvider.mutate({ id: provider.id, ...data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createProvider.mutate(data as any, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Provedor' : 'Novo Provedor'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize as credenciais do provedor.' : 'Configure um novo provedor de comunicação.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do Provedor</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Principal" />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={providerType} onValueChange={setProviderType} disabled={isEditing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providerTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {providerType === 'uazapi' && (
            <>
              <div>
                <Label>URL da API UaZapi</Label>
                <Input value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>API Key (Admin Token)</Label>
                <Input value={evoApikey} onChange={(e) => setEvoApikey(e.target.value)} type="password" placeholder="Token de acesso admin" />
              </div>
            </>
          )}

          {providerType === 'waba' && (
            <>
              <div>
                <Label>Meta App ID</Label>
                <Input value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} placeholder="ID do App Meta" />
              </div>
              <div>
                <Label>Meta App Secret</Label>
                <Input value={metaAppSecret} onChange={(e) => setMetaAppSecret(e.target.value)} type="password" placeholder="App Secret" />
              </div>
              <div>
                <Label>WABA Business ID</Label>
                <Input value={wabaBusinessId} onChange={(e) => setWabaBusinessId(e.target.value)} placeholder="ID da conta WABA" />
              </div>
              <div>
                <Label>Access Token Permanente</Label>
                <Input value={wabaToken} onChange={(e) => setWabaToken(e.target.value)} type="password" placeholder="Token permanente" />
              </div>
            </>
          )}

          {providerType === 'instagram' && (
            <>
              <div>
                <Label>Page ID</Label>
                <Input value={instagramPageId} onChange={(e) => setInstagramPageId(e.target.value)} placeholder="ID da página do Facebook" />
              </div>
              <div>
                <Label>Instagram User ID</Label>
                <Input value={instagramUserId} onChange={(e) => setInstagramUserId(e.target.value)} placeholder="ID do usuário Instagram" />
              </div>
              <div>
                <Label>Page Access Token</Label>
                <Input value={pageAccessToken} onChange={(e) => setPageAccessToken(e.target.value)} type="password" placeholder="Token da página" />
              </div>
              <div>
                <Label>Nome da Página</Label>
                <Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Nome exibido" />
              </div>
            </>
          )}

          {providerType === 'webchat' && (
            <div className="p-4 border border-border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                O provedor WebChat utiliza configurações internas do sistema. Apenas o nome é necessário para referência.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
