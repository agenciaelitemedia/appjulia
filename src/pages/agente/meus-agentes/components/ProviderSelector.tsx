import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutList, QrCode } from 'lucide-react';
import { UserAgent } from '../types';
import { ConfigureInstanceDialog } from './ConfigureInstanceDialog';
import { QueueConnectionDialog } from './QueueConnectionDialog';

interface ProviderSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess: () => void;
}

export function ProviderSelector({ open, onOpenChange, agent, onSuccess }: ProviderSelectorProps) {
  const [showUazapi, setShowUazapi] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const handleUazapiSuccess = () => {
    setShowUazapi(false);
    onOpenChange(false);
    onSuccess();
  };

  const handleQueueSuccess = () => {
    setShowQueue(false);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o tipo de conexão</DialogTitle>
            <DialogDescription>
              Selecione como deseja conectar o WhatsApp para{' '}
              <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 text-left"
              onClick={() => {
                onOpenChange(false);
                setShowUazapi(true);
              }}
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <span className="font-semibold">QR Code (UaZapi)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Conexão via QR Code. Não oficial, usa WhatsApp Web.
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto w-full p-4 flex flex-col items-start gap-2 text-left whitespace-normal break-words"
              onClick={() => {
                onOpenChange(false);
                setShowQueue(true);
              }}
            >
              <div className="flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Filas</span>
              </div>
              <span className="text-xs text-muted-foreground whitespace-normal break-words w-full">
                Conecte via uma fila existente (UaZapi ou API Oficial). As mensagens serão encaminhadas automaticamente.
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfigureInstanceDialog
        open={showUazapi}
        onOpenChange={setShowUazapi}
        agent={agent}
        onSuccess={handleUazapiSuccess}
      />

      <QueueConnectionDialog
        open={showQueue}
        onOpenChange={setShowQueue}
        agent={agent}
        onSuccess={handleQueueSuccess}
      />
    </>
  );
}
