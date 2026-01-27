import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, Settings, Unplug } from 'lucide-react';
import { UserAgent, ConnectionStatus } from '../types';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { QRCodeDialog } from './QRCodeDialog';
import { ConfigureInstanceDialog } from './ConfigureInstanceDialog';
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
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { disconnect, isDisconnecting, connect, isConnecting } = useConnectionActions(agent);
  const queryClient = useQueryClient();

  const handleConfigureSuccess = () => {
    // Invalidar cache para atualizar a lista de agentes
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
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
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigDialogOpen(true)}
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar Instância
          </Button>
          <ConfigureInstanceDialog
            open={configDialogOpen}
            onOpenChange={setConfigDialogOpen}
            agent={agent}
            onSuccess={handleConfigureSuccess}
          />
        </>
      );

    case 'disconnected':
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              connect();
              setQrDialogOpen(true);
            }}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="w-4 h-4 mr-2" />
            )}
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
