import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpsertTelephonyProvider, type TelephonyProvider } from '../hooks/useTelephonyProviders';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider?: TelephonyProvider | null;
}

export function ProviderDialog({ open, onOpenChange, provider }: Props) {
  const isEditing = !!provider;
  const upsert = useUpsertTelephonyProvider();

  const [name, setName] = useState('');
  const [type, setType] = useState<'api4com' | '3cplus'>('api4com');
  const [api4comDomain, setApi4comDomain] = useState('');
  const [api4comToken, setApi4comToken] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [threecplusToken, setThreecplusToken] = useState('');
  const [threecplusBaseUrl, setThreecplusBaseUrl] = useState('');
  const [threecplusWsUrl, setThreecplusWsUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(provider?.name ?? '');
      setType(provider?.provider ?? 'api4com');
      setApi4comDomain(provider?.api4com_domain ?? '');
      setApi4comToken(provider?.api4com_token ?? '');
      setSipDomain(provider?.sip_domain ?? '');
      setThreecplusToken(provider?.threecplus_token ?? '');
      setThreecplusBaseUrl(provider?.threecplus_base_url ?? '');
      setThreecplusWsUrl(provider?.threecplus_ws_url ?? '');
      setIsDefault(provider?.is_default ?? false);
      setIsActive(provider?.is_active ?? true);
    }
  }, [open, provider]);

  async function handleSave() {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      id: provider?.id,
      name: name.trim(),
      provider: type,
      api4com_domain: type === 'api4com' ? api4comDomain || null : null,
      api4com_token: type === 'api4com' ? api4comToken || null : null,
      sip_domain: sipDomain || null,
      threecplus_token: type === '3cplus' ? threecplusToken || null : null,
      threecplus_base_url: type === '3cplus' ? threecplusBaseUrl || null : null,
      threecplus_ws_url: type === '3cplus' ? threecplusWsUrl || null : null,
      is_default: isDefault,
      is_active: isActive,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar provedor' : 'Novo provedor de telefonia'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Api4Com Principal" />
            </div>
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api4com">Api4Com</SelectItem>
                  <SelectItem value="3cplus">3C+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === 'api4com' && (
            <>
              <div className="space-y-1.5">
                <Label>Domínio API (REST)</Label>
                <Input value={api4comDomain} onChange={(e) => setApi4comDomain(e.target.value)} placeholder="api.provedor.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Domínio SIP (WebRTC)</Label>
                <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="seudominio.provedor.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Token Api4Com</Label>
                <Input type="password" value={api4comToken} onChange={(e) => setApi4comToken(e.target.value)} />
              </div>
            </>
          )}

          {type === '3cplus' && (
            <>
              <div className="space-y-1.5">
                <Label>Token API</Label>
                <Input type="password" value={threecplusToken} onChange={(e) => setThreecplusToken(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>URL Base API</Label>
                <Input value={threecplusBaseUrl} onChange={(e) => setThreecplusBaseUrl(e.target.value)} placeholder="https://api.3cplus.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label>URL WebSocket</Label>
                <Input value={threecplusWsUrl} onChange={(e) => setThreecplusWsUrl(e.target.value)} placeholder="wss://socket.3cplus.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label>Domínio SIP</Label>
                <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex items-center justify-between p-3 rounded border">
            <div>
              <Label>Provedor padrão</Label>
              <p className="text-xs text-muted-foreground">Usado nas contratações automáticas.</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
          <div className="flex items-center justify-between p-3 rounded border">
            <div>
              <Label>Ativo</Label>
              <p className="text-xs text-muted-foreground">Desligue para retirar do pool sem excluir.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending || !name.trim()}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
