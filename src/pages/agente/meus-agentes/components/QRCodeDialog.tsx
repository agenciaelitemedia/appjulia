import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import { UserAgent } from '../types';
import { useQRCodePolling } from '../hooks/useQRCodePolling';
import { toast } from 'sonner';

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onConnected: () => void;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  agent,
  onConnected,
}: QRCodeDialogProps) {
  const { data, isLoading, isError, countdown } = useQRCodePolling(
    agent.evo_url,
    agent.evo_apikey,
    open
  );

  // Auto-close quando conectar
  useEffect(() => {
    if (data?.isConnected && open) {
      toast.success(`WhatsApp conectado com sucesso!${data.profileName ? ` (${data.profileName})` : ''}`);
      onConnected();
      onOpenChange(false);
    }
  }, [data?.isConnected, data?.profileName, open, onConnected, onOpenChange]);

  const hasQRCode = data?.qrCode && data.qrCode.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {agent.business_name || agent.client_name || 'Agente'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* QR Code Area */}
          <div className="relative w-64 h-64 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {isLoading && (
              <Skeleton className="w-full h-full" />
            )}

            {isError && (
              <div className="text-center p-4">
                <p className="text-sm text-destructive">Erro ao carregar QR Code</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifique a conexão e tente novamente
                </p>
              </div>
            )}

            {!isLoading && !isError && hasQRCode && (
              <img
                src={data.qrCode.startsWith('data:') ? data.qrCode : `data:image/png;base64,${data.qrCode}`}
                alt="QR Code WhatsApp"
                className="w-full h-full object-contain p-2"
              />
            )}

            {!isLoading && !isError && !hasQRCode && !data?.isConnected && (
              <div className="text-center p-4">
                <p className="text-sm text-muted-foreground">
                  Aguardando QR Code...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Atualizando em {countdown}s
                </p>
              </div>
            )}

            {data?.isConnected && (
              <div className="text-center p-4">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Conectado!</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          {!data?.isConnected && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code com o WhatsApp do seu celular
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Atualização automática em {countdown}s</span>
              </div>
            </div>
          )}

          {/* Instructions details */}
          {!data?.isConnected && (
            <div className="w-full bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>1. Abra o WhatsApp no seu celular</p>
              <p>2. Toque em <strong>Menu</strong> ou <strong>Configurações</strong></p>
              <p>3. Selecione <strong>Dispositivos Conectados</strong></p>
              <p>4. Toque em <strong>Conectar Dispositivo</strong></p>
              <p>5. Aponte o celular para o QR Code acima</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {data?.isConnected ? 'Fechar' : 'Cancelar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
