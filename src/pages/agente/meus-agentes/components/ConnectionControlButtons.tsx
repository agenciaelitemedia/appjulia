import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, QrCode, Settings, Unplug, Trash2 } from 'lucide-react';
import { UserAgent, ConnectionStatus } from '../types';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { QRCodeDialog } from './QRCodeDialog';
import { ConfigureInstanceDialog } from './ConfigureInstanceDialog';
import { DeleteInstanceDialog } from './DeleteInstanceDialog';
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
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { disconnect, isDisconnecting, connect, isConnecting } = useConnectionActions(agent);
  const queryClient = useQueryClient();

  const handleConfigureSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
  };

  const handleConnected = () => {
    queryClient.invalidateQueries({
      queryKey: ['connection-status', agent.evo_url, agent.evo_instancia],
    });
  };

  const handleDisconnectConfirm = () => {
    disconnect();
    setDisconnectDialogOpen(false);
  };

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
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
            size="sm"
            onClick={() => setConfigDialogOpen(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
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
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                connect();
                setQrDialogOpen(true);
              }}
              disabled={isConnecting}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Conectar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="Excluir instância"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <QRCodeDialog
            open={qrDialogOpen}
            onOpenChange={setQrDialogOpen}
            agent={agent}
            onConnected={handleConnected}
          />
          <DeleteInstanceDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            agent={agent}
            onSuccess={handleDeleteSuccess}
          />
        </>
      );

    case 'connected':
      return (
        <>
          <Button
            size="sm"
            onClick={() => setDisconnectDialogOpen(true)}
            disabled={isDisconnecting}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDisconnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Unplug className="w-4 h-4 mr-2" />
            )}
            Desconectar
          </Button>

          <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja desconectar o WhatsApp de{' '}
                  <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>?
                  <br /><br />
                  Isso irá encerrar a sessão ativa e você precisará escanear o QR Code novamente para reconectar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnectConfirm}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Sim, Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );

    default:
      return null;
  }
}
