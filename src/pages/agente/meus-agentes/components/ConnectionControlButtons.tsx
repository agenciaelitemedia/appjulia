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
import { Loader2, QrCode, Settings, Unplug, Trash2, Shield } from 'lucide-react';
import { UserAgent, ConnectionStatus } from '../types';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { QRCodeDialog } from './QRCodeDialog';
import { ConfigureInstanceDialog } from './ConfigureInstanceDialog';
import { DeleteInstanceDialog } from './DeleteInstanceDialog';
import { ProviderSelector } from './ProviderSelector';
import { WabaSetupDialog } from './WabaSetupDialog';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [wabaDisconnecting, setWabaDisconnecting] = useState(false);
  const { disconnect, isDisconnecting, connect, isConnecting } = useConnectionActions(agent);
  const queryClient = useQueryClient();

  const handleConfigureSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
  };

  const handleConnected = () => {
    queryClient.invalidateQueries({
      queryKey: ['connection-status', agent.hub, agent.evo_url, agent.evo_instancia, agent.agent_id_from_agents],
    });
  };

  const handleDisconnectConfirm = () => {
    disconnect();
    setDisconnectDialogOpen(false);
  };

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
  };

  const handleProviderSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
    queryClient.invalidateQueries({ queryKey: ['connection-status'] });
  };

  const handleWabaDisconnect = async () => {
    setWabaDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('waba-admin', {
        body: { action: 'disconnect', agentId: agent.agent_id_from_agents },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Falha ao desconectar');
      toast.success('WhatsApp API Oficial desconectado');
      queryClient.invalidateQueries({ queryKey: ['user-agents'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar');
    } finally {
      setWabaDisconnecting(false);
      setDisconnectDialogOpen(false);
    }
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
            onClick={() => setProviderDialogOpen(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar Conexão
          </Button>
          <ProviderSelector
            open={providerDialogOpen}
            onOpenChange={setProviderDialogOpen}
            agent={agent}
            onSuccess={handleProviderSuccess}
          />
        </>
      );

    case 'disconnected':
      // Check if it was a WABA connection that is disconnected
      if (agent.hub === 'waba') {
        return (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setProviderDialogOpen(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Reconectar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDisconnectDialogOpen(true)}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                title="Remover conexão"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover conexão WABA</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja remover a conexão API Oficial de{' '}
                    <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleWabaDisconnect}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Sim, Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <WabaSetupDialog
              open={providerDialogOpen}
              onOpenChange={setProviderDialogOpen}
              agent={agent}
              onSuccess={handleProviderSuccess}
            />
          </>
        );
      }

      // UaZapi disconnected
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

    case 'waba_connected':
      return (
        <>
          <Button
            size="sm"
            onClick={() => setDisconnectDialogOpen(true)}
            disabled={wabaDisconnecting}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {wabaDisconnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Unplug className="w-4 h-4 mr-2" />
            )}
            Desconectar
          </Button>

          <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar API Oficial</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja desconectar a API Oficial Meta de{' '}
                  <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>?
                  <br /><br />
                  As credenciais serão removidas e você precisará refazer o cadastro para reconectar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleWabaDisconnect}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Sim, Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
