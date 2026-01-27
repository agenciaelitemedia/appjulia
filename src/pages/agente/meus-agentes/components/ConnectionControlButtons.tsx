import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, Settings, Unplug } from 'lucide-react';
import { UserAgent, ConnectionStatus } from '../types';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { QRCodeDialog } from './QRCodeDialog';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ConnectionControlButtonsProps {
  agent: UserAgent;
  status: ConnectionStatus;
  isLoading: boolean;
}

export function ConnectionControlButtons({
  agent,
  status,
  isLoading,
}: ConnectionControlButtonsProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const { disconnect, isDisconnecting } = useConnectionActions(agent);
  const queryClient = useQueryClient();

  const handleConfigureInstance = () => {
    toast.info('Entre em contato com o suporte para configurar sua instância WhatsApp');
  };

  const handleConnected = () => {
    // Invalidar cache para atualizar o status
    queryClient.invalidateQueries({
      queryKey: ['connection-status', agent.evo_url, agent.evo_instancia],
    });
  };

  if (isLoading || status === 'checking') {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Verificando...
      </Button>
    );
  }

  switch (status) {
    case 'no_config':
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleConfigureInstance}
          className="w-full"
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurar Instância
        </Button>
      );

    case 'disconnected':
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQrDialogOpen(true)}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Conectar
          </Button>
          <QRCodeDialog
            open={qrDialogOpen}
            onOpenChange={setQrDialogOpen}
            agent={agent}
            onConnected={handleConnected}
          />
        </>
      );

    case 'connected':
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          disabled={isDisconnecting}
          className="w-full"
        >
          {isDisconnecting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Unplug className="w-4 h-4 mr-2" />
          )}
          Desconectar
        </Button>
      );

    default:
      return null;
  }
}
