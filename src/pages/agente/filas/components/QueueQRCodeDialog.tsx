import { useState, useEffect, useCallback, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

interface QueueQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueId: string;
  queueName: string;
  onConnected: () => void;
}

export function QueueQRCodeDialog({
  open,
  onOpenChange,
  queueId,
  queueName,
  onConnected,
}: QueueQRCodeDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQRCode = useCallback(async () => {
    if (!queueId) return;
    setLoading(true);
    try {
      // Trigger connect to generate QR
      await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'connect', queue_id: queueId },
      });

      // Fetch status which contains QR code
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'status', queue_id: queueId },
      });

      if (!error && data?.data) {
        const inst = data.data.instance || {};
        const status = data.data.status || {};
        const connected = status.connected === true;

        if (connected) {
          setIsConnected(true);
          setProfileName(inst.profileName || null);
          setQrCode(null);
          onConnected();
        } else {
          setQrCode(inst.qrcode || null);
          setIsConnected(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setCountdown(30);
    }
  }, [queueId, onConnected]);

  // Polling every 30s
  useEffect(() => {
    if (!open || isConnected) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    fetchQRCode();

    intervalRef.current = setInterval(fetchQRCode, 30000);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [open, isConnected, fetchQRCode]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQrCode(null);
      setIsConnected(false);
      setProfileName(null);
      setCountdown(30);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>{queueName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative w-64 h-64 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {loading && !qrCode && (
              <Skeleton className="w-full h-full" />
            )}

            {qrCode && (
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-full h-full object-contain p-2"
              />
            )}

            {!loading && !qrCode && !isConnected && (
              <div className="text-center p-4">
                <p className="text-sm text-muted-foreground">Aguardando QR Code...</p>
                <p className="text-xs text-muted-foreground mt-1">Atualizando em {countdown}s</p>
              </div>
            )}

            {isConnected && (
              <div className="text-center p-4">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Conectado!</p>
                {profileName && <p className="text-xs text-muted-foreground mt-1">{profileName}</p>}
              </div>
            )}
          </div>

          {!isConnected && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code com o WhatsApp do seu celular
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Atualização automática em {countdown}s</span>
                </div>
              </div>
              <div className="w-full bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>1. Abra o WhatsApp no seu celular</p>
                <p>2. Toque em <strong>Menu</strong> ou <strong>Configurações</strong></p>
                <p>3. Selecione <strong>Dispositivos Conectados</strong></p>
                <p>4. Toque em <strong>Conectar Dispositivo</strong></p>
                <p>5. Aponte o celular para o QR Code acima</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isConnected ? 'Fechar' : 'Cancelar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
