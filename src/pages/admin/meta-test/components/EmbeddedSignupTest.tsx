import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { EventLog } from './EventLog';
import type { EventLogEntry, SignupData } from '../types';

interface EmbeddedSignupTestProps {
  configId: string;
  sdkLoaded: boolean;
  events: EventLogEntry[];
  onAddEvent: (type: string, data?: Record<string, unknown>) => void;
  onSignupComplete: (data: SignupData) => void;
}

export function EmbeddedSignupTest({
  configId,
  sdkLoaded,
  events,
  onAddEvent,
  onSignupComplete,
}: EmbeddedSignupTestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const signupDataRef = useRef<SignupData | null>(null);

  const handleLaunchSignup = () => {
    if (!window.FB) {
      onAddEvent('ERROR', { message: 'Facebook SDK não carregado' });
      return;
    }

    if (!configId.trim()) {
      onAddEvent('ERROR', { message: 'Config ID é obrigatório' });
      return;
    }

    setIsLoading(true);
    onAddEvent('SIGNUP_STARTED', { configId });

    // Listen for embedded signup events
    const sessionInfoListener = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return;

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          onAddEvent(`WA_EMBEDDED_SIGNUP: ${data.event}`, data.data);

          if (data.event === 'FINISH') {
            const newData: SignupData = {
              waba_id: data.data?.waba_id,
              phone_number_id: data.data?.phone_number_id,
            };
            signupDataRef.current = { ...signupDataRef.current, ...newData };
            setSignupData((prev) => ({ ...prev, ...newData }));
          }

          if (data.event === 'CANCEL' || data.event === 'ERROR') {
            setIsLoading(false);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', sessionInfoListener);

    window.FB.login(
      (response) => {
        window.removeEventListener('message', sessionInfoListener);
        setIsLoading(false);

        if (response.authResponse?.code) {
          onAddEvent('LOGIN_SUCCESS', { 
            code: response.authResponse.code.substring(0, 20) + '...' 
          });
          
          const finalData: SignupData = {
            ...signupDataRef.current,
            code: response.authResponse.code,
          };
          signupDataRef.current = finalData;
          setSignupData(finalData);
          onSignupComplete(finalData);
        } else {
          onAddEvent('LOGIN_FAILED', { status: response.status });
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: 2,
          feature: 'whatsapp_embedded_signup',
        },
      }
    );
  };

  return (
    <Card className={!sdkLoaded ? 'opacity-50' : ''}>
      <CardHeader>
        <CardTitle className="text-lg">Etapa 2: Embedded Signup</CardTitle>
        <CardDescription>
          Inicie o fluxo de cadastro do WhatsApp Business
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleLaunchSignup}
          disabled={!sdkLoaded || isLoading || !configId.trim()}
          className="bg-[#1877F2] hover:bg-[#166FE5]"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Iniciar Embedded Signup
        </Button>

        <EventLog events={events} />

        {signupData?.waba_id && (
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-sm">
              <strong>WABA ID:</strong> {signupData.waba_id}
            </p>
            <p className="text-sm">
              <strong>Phone Number ID:</strong> {signupData.phone_number_id}
            </p>
            {signupData.code && (
              <p className="text-sm">
                <strong>Auth Code:</strong> {signupData.code.substring(0, 30)}...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
