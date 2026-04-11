import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, WifiOff, Phone } from 'lucide-react';
import { Queue, QueueFormData, useQueueMutations } from '../hooks/useQueues';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue?: Queue | null;
}

interface InstanceInfo {
  instanceName?: string;
  status?: string;
  phoneNumber?: string;
  profileName?: string;
  profilePicUrl?: string;
}

export function QueueFormDialog({ open, onOpenChange, queue }: QueueFormDialogProps) {
  const { updateQueue } = useQueueMutations();
  const isEditing = !!queue;

  const [name, setName] = useState('');
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (queue) {
      setName(queue.name);
      setInstanceInfo(null);
      if (queue.channel_type === 'uazapi' && queue.evo_instance) {
        fetchInstanceInfo();
      }
    } else {
      setName('');
      setInstanceInfo(null);
    }
  }, [queue, open]);

  const fetchInstanceInfo = async () => {
    if (!queue?.evo_instance || !queue?.evo_url || !queue?.evo_apikey) return;
    setLoadingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          method: 'GET',
          path: `/instance/connectionState/${queue.evo_instance}`,
          evo_url: queue.evo_url,
          evo_apikey: queue.evo_apikey,
        },
      });
      if (!error && data) {
        setInstanceInfo({
          instanceName: queue.evo_instance,
          status: data?.instance?.state || data?.state || 'unknown',
          phoneNumber: data?.instance?.phoneNumber || data?.phoneNumber || '',
          profileName: data?.instance?.profileName || data?.profileName || '',
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingInstance(false);
    }
  };

  const handleConnect = async () => {
    if (!queue?.evo_instance || !queue?.evo_url || !queue?.evo_apikey) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          method: 'POST',
          path: `/instance/connect/${queue.evo_instance}`,
          evo_url: queue.evo_url,
          evo_apikey: queue.evo_apikey,
        },
      });
      if (error) throw new Error(error.message);
      toast.success('Solicitação de conexão enviada. Aguarde o QR Code ou a conexão automática.');
      // Refresh info after a delay
      setTimeout(fetchInstanceInfo, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!queue?.evo_instance || !queue?.evo_url || !queue?.evo_apikey) return;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          method: 'DELETE',
          path: `/instance/logout/${queue.evo_instance}`,
          evo_url: queue.evo_url,
          evo_apikey: queue.evo_apikey,
        },
      });
      if (error) throw new Error(error.message);
      toast.success('Instância desconectada');
      setInstanceInfo((prev) => prev ? { ...prev, status: 'close' } : null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const isPending = updateQueue.isPending;

  const handleSubmit = () => {
    if (!name.trim() || !queue) return;
    updateQueue.mutate({ queue_id: queue.id, name: name.trim() }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const isConnected = instanceInfo?.status === 'open';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Fila</DialogTitle>
          <DialogDescription>
            Visualize as configurações e gerencie a conexão da fila.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Fila</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Principal" />
          </div>

          {queue?.channel_type === 'uazapi' && (
            <>
              <div>
                <Label className="text-muted-foreground">URL da API</Label>
                <Input value={queue.evo_url || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">API Key</Label>
                <Input value={queue.evo_apikey ? '••••••••••••' : ''} disabled type="password" className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Instância</Label>
                <Input value={queue.evo_instance || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>

              {/* Instance connection section */}
              <div className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Status da Conexão</Label>
                  {loadingInstance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : instanceInfo ? (
                    <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
                      {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {isConnected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sem dados</Badge>
                  )}
                </div>

                {instanceInfo && isConnected && (
                  <div className="grid gap-1 text-sm">
                    {instanceInfo.profileName && (
                      <p><span className="text-muted-foreground">Nome:</span> <span className="text-foreground">{instanceInfo.profileName}</span></p>
                    )}
                    {instanceInfo.phoneNumber && (
                      <p><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{instanceInfo.phoneNumber}</span></p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {!isConnected && (
                    <Button size="sm" onClick={handleConnect} disabled={connecting}>
                      {connecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wifi className="w-4 h-4 mr-1" />}
                      Conectar
                    </Button>
                  )}
                  {isConnected && (
                    <Button size="sm" variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                      {disconnecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <WifiOff className="w-4 h-4 mr-1" />}
                      Desconectar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={fetchInstanceInfo} disabled={loadingInstance}>
                    {loadingInstance ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {queue?.channel_type === 'waba' && (
            <>
              <div>
                <Label className="text-muted-foreground">WABA ID</Label>
                <Input value={queue.waba_id || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Access Token</Label>
                <Input value={queue.waba_token ? '••••••••••••' : ''} disabled type="password" className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Phone Number ID</Label>
                <Input value={queue.waba_number_id || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
