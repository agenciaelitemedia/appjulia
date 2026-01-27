import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Settings, Wifi, Database } from 'lucide-react';
import { UserAgent } from '../types';
import { useConfigureInstance } from '../hooks/useConfigureInstance';
import { cn } from '@/lib/utils';

interface ConfigureInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess?: () => void;
}

type Step = 'idle' | 'creating' | 'webhook' | 'saving' | 'success' | 'error';

interface StepInfo {
  step: Step;
  label: string;
  icon: React.ReactNode;
}

const steps: StepInfo[] = [
  { step: 'creating', label: 'Criando instância...', icon: <Settings className="w-4 h-4" /> },
  { step: 'webhook', label: 'Configurando webhook...', icon: <Wifi className="w-4 h-4" /> },
  { step: 'saving', label: 'Salvando credenciais...', icon: <Database className="w-4 h-4" /> },
];

export function ConfigureInstanceDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: ConfigureInstanceDialogProps) {
  const [instanceName, setInstanceName] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { configureInstanceAsync, isConfiguring, reset } = useConfigureInstance();

  // Set default instance name when dialog opens
  useEffect(() => {
    if (open) {
      const clientName = agent.client_name || agent.business_name || 'Cliente';
      const defaultName = `[JulIAv2] - ${clientName}`;
      setInstanceName(defaultName);
      setCurrentStep('idle');
      setErrorMessage(null);
      reset();
    }
  }, [open, agent, reset]);

  const handleConfigure = async () => {
    if (!instanceName.trim()) return;

    setErrorMessage(null);
    
    try {
      // Simulate step progress (actual steps happen server-side)
      setCurrentStep('creating');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCurrentStep('webhook');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setCurrentStep('saving');
      
      await configureInstanceAsync({ agent, instanceName: instanceName.trim() });
      
      setCurrentStep('success');
      
      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
      
    } catch (error) {
      setCurrentStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  const handleRetry = () => {
    setCurrentStep('idle');
    setErrorMessage(null);
    reset();
  };

  const getStepStatus = (step: Step): 'pending' | 'active' | 'complete' | 'error' => {
    const stepOrder: Step[] = ['idle', 'creating', 'webhook', 'saving', 'success'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);

    if (currentStep === 'error') return 'error';
    if (currentStep === 'success') return 'complete';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const isProcessing = ['creating', 'webhook', 'saving'].includes(currentStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Instância WhatsApp</DialogTitle>
          <DialogDescription>
            Configure uma nova instância WhatsApp para o agente {agent.cod_agent}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Instance Name Input */}
          {currentStep === 'idle' && (
            <div className="space-y-2">
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                value={instanceName}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Este nome será usado para identificar a instância no servidor
              </p>
            </div>
          )}

          {/* Progress Steps */}
          {(isProcessing || currentStep === 'success' || currentStep === 'error') && (
            <div className="space-y-3">
              {steps.map(({ step, label, icon }) => {
                const status = getStepStatus(step);
                return (
                  <div
                    key={step}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      status === 'active' && 'bg-primary/10 border-primary',
                      status === 'complete' && 'bg-primary/10 border-primary/50',
                      status === 'error' && 'bg-destructive/10 border-destructive/50',
                      status === 'pending' && 'bg-muted/50 border-border opacity-50'
                    )}
                  >
                    <div className="flex-shrink-0">
                      {status === 'active' && (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      )}
                      {status === 'complete' && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                      {status === 'error' && (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      {status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className={cn(
                        'text-sm font-medium',
                        status === 'pending' && 'text-muted-foreground'
                      )}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Success Message */}
          {currentStep === 'success' && (
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-2" />
              <p className="font-medium text-primary">
                Instância configurada com sucesso!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Agora você pode conectar escaneando o QR Code
              </p>
            </div>
          )}

          {/* Error Message */}
          {currentStep === 'error' && errorMessage && (
            <div className="p-4 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {currentStep === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfigure} disabled={!instanceName.trim()}>
                Configurar
              </Button>
            </>
          )}
          
          {currentStep === 'error' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={handleRetry}>
                Tentar Novamente
              </Button>
            </>
          )}

          {isProcessing && (
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
