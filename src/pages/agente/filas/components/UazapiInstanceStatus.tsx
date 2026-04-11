import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Wifi, WifiOff, RefreshCw, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QueueQRCodeDialog } from './QueueQRCodeDialog';

interface InstanceInfo {
  instanceName?: string;
  status?: string;
  phoneNumber?: string;
  profileName?: string;
  profilePictureUrl?: string;
}

interface UazapiInstanceStatusProps {
  queueId: string;
  queueName?: string;
}

export function UazapiInstanceStatus({ queueId, queueName }: UazapiInstanceStatusProps) {
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  const fetchStatus = async () => {
    if (!queueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'status', queue_id: queueId },
      });
      if (!error && data?.data) {
        const inst = data.data.instance || data.data;
        const status = data.data.status || data.data;
        setInstanceInfo({
          instanceName: inst.name || inst.instanceName || '',
          status: (status.connected || inst.status === 'open') ? 'open' : 'close',
          phoneNumber: inst.owner || inst.phoneNumber || '',
          profileName: inst.profileName || inst.pushname || '',
          profilePictureUrl: inst.profilePictureUrl || inst.profilePicUrl || inst.imgUrl || '',
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [queueId]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'disconnect', queue_id: queueId },
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

  const isConnected = instanceInfo?.status === 'open';

  return (
    <>
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : instanceInfo ? (
              <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1 text-[10px] px-1.5 py-0">
                {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                {isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sem dados</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {instanceInfo && isConnected && (
          <div className="flex items-center gap-2 text-[11px]">
            <Avatar className="h-8 w-8 border border-border">
              {instanceInfo.profilePictureUrl ? (
                <AvatarImage src={instanceInfo.profilePictureUrl} alt={instanceInfo.profileName || 'Perfil'} />
              ) : null}
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5 min-w-0">
              {instanceInfo.profileName && (
                <p className="text-foreground font-medium truncate">{instanceInfo.profileName}</p>
              )}
              {instanceInfo.phoneNumber && (
                <p className="text-muted-foreground truncate">{instanceInfo.phoneNumber}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-1.5">
          {!isConnected && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setQrDialogOpen(true)} disabled={loading}>
              <Wifi className="w-3 h-3 mr-1" />
              Conectar
            </Button>
          )}
          {isConnected && (
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <WifiOff className="w-3 h-3 mr-1" />}
              Desconectar
            </Button>
          )}
        </div>
      </div>

      <QueueQRCodeDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        queueId={queueId}
        queueName={queueName || ''}
        onConnected={() => {
          fetchStatus();
          toast.success('WhatsApp conectado com sucesso!');
        }}
      />
    </>
  );
}
