import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserAgent } from '../types';
import { toast } from 'sonner';

interface WabaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess: () => void;
}

type SetupStep = 'idle' | 'signup' | 'exchanging' | 'saving' | 'verifying' | 'done' | 'error';

const META_APP_ID = '848563184591665';
const META_CONFIG_ID = '1349553886498498';

export function WabaSetupDialog({ open, onOpenChange, agent, onSuccess }: WabaSetupDialogProps) {
  const [step, setStep] = useState<SetupStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const signupDataRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  const resetState = () => {
    setStep('idle');
    setErrorMessage('');
    setPhoneNumber('');
    signupDataRef.current = {};
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const handleStartSignup = () => {
    if (!window.FB) {
      // Load FB SDK first
      loadFacebookSDK().then(() => launchSignup());
      return;
    }
    launchSignup();
  };

  const loadFacebookSDK = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.FB) { resolve(); return; }

      window.fbAsyncInit = () => {
        window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: true, version: 'v22.0' });
        resolve();
      };

      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  };

  const launchSignup = () => {
    setStep('signup');

    const sessionInfoListener = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            signupDataRef.current = {
              ...signupDataRef.current,
              waba_id: data.data?.waba_id,
              phone_number_id: data.data?.phone_number_id,
            };
          }
          if (data.event === 'CANCEL' || data.event === 'ERROR') {
            setStep('idle');
          }
        }
      } catch { /* ignore non-JSON */ }
    };

    window.addEventListener('message', sessionInfoListener);

    window.FB.login(
      (response) => {
        window.removeEventListener('message', sessionInfoListener);

        if (response.authResponse?.code) {
          processSignup(
            response.authResponse.code,
            signupDataRef.current.waba_id || '',
            signupDataRef.current.phone_number_id || ''
          );
        } else {
          setStep('idle');
          toast.error('Login cancelado ou falhou');
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: 2, feature: 'whatsapp_embedded_signup' },
      }
    );
  };

  const processSignup = async (code: string, wabaId: string, phoneNumberId: string) => {
    try {
      // Step 1: Exchange token
      setStep('exchanging');
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('waba-admin', {
        body: { action: 'exchange_token', code },
      });

      if (tokenError || !tokenData?.success) {
        throw new Error(tokenData?.error || tokenError?.message || 'Falha ao trocar token');
      }

      // Step 2: Save credentials
      setStep('saving');
      const { data: saveData, error: saveError } = await supabase.functions.invoke('waba-admin', {
        body: {
          action: 'save_credentials',
          agentId: agent.agent_id_from_agents,
          wabaId,
          accessToken: tokenData.access_token,
          phoneNumberId,
        },
      });

      if (saveError || !saveData?.success) {
        throw new Error(saveData?.error || saveError?.message || 'Falha ao salvar credenciais');
      }

      // Step 3: Verify
      setStep('verifying');
      const { data: verifyData } = await supabase.functions.invoke('waba-admin', {
        body: { action: 'verify_connection', agentId: agent.agent_id_from_agents },
      });

      if (verifyData?.phone_number) {
        setPhoneNumber(verifyData.phone_number);
      }

      setStep('done');
      toast.success('WhatsApp API Oficial conectado com sucesso!');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setErrorMessage(msg);
      setStep('error');
      toast.error(msg);
    }
  };

  const stepMessages: Record<SetupStep, string> = {
    idle: '',
    signup: 'Aguardando conclusão do cadastro...',
    exchanging: 'Trocando código por token...',
    saving: 'Salvando credenciais...',
    verifying: 'Verificando conexão...',
    done: 'Conexão estabelecida!',
    error: 'Erro na configuração',
  };

  const isProcessing = ['signup', 'exchanging', 'saving', 'verifying'].includes(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            API Oficial Meta
          </DialogTitle>
          <DialogDescription>
            Conectar WhatsApp oficial para{' '}
            <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'idle' && (
            <>
              <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                <p><strong>O que vai acontecer:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Um popup do Facebook será aberto</li>
                  <li>Selecione ou crie sua conta Business</li>
                  <li>Vincule seu número de telefone</li>
                  <li>A conexão será configurada automaticamente</li>
                </ol>
              </div>
              <Button
                onClick={handleStartSignup}
                className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
              >
                <Shield className="w-4 h-4 mr-2" />
                Iniciar Cadastro Meta
              </Button>
            </>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">{stepMessages[step]}</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium">WhatsApp API Oficial conectado!</p>
              {phoneNumber && (
                <p className="text-xs text-muted-foreground">Número: {phoneNumber}</p>
              )}
              <Button onClick={() => handleClose(false)} className="mt-2">
                Fechar
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">Falha na configuração</p>
              <p className="text-xs text-muted-foreground text-center">{errorMessage}</p>
              <Button variant="outline" onClick={resetState} className="mt-2">
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
