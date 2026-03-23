import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Shield } from 'lucide-react';
import { UserAgent } from '../types';
import { ConfigureInstanceDialog } from './ConfigureInstanceDialog';
import { WabaSetupDialog } from './WabaSetupDialog';

interface ProviderSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess: () => void;
}

export function ProviderSelector({ open, onOpenChange, agent, onSuccess }: ProviderSelectorProps) {
  const [showUazapi, setShowUazapi] = useState(false);
  const [showWaba, setShowWaba] = useState(false);

  const handleUazapiSuccess = () => {
    setShowUazapi(false);
    onOpenChange(false);
    onSuccess();
  };

  const handleWabaSuccess = () => {
    setShowWaba(false);
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
                <span className="font-semibold">UaZapi (QR Code)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Conexão via QR Code. Não oficial, usa WhatsApp Web.
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 text-left"
              onClick={() => {
                onOpenChange(false);
                setShowWaba(true);
              }}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">API Oficial Meta</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Conexão oficial via Meta Business. Mais estável e sem risco de banimento.
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

      <WabaSetupDialog
        open={showWaba}
        onOpenChange={setShowWaba}
        agent={agent}
        onSuccess={handleWabaSuccess}
      />
    </>
  );
}
