import { useState, useCallback } from 'react';
import { MetaSdkLoader } from './components/MetaSdkLoader';
import { EmbeddedSignupTest } from './components/EmbeddedSignupTest';
import { TokenExchangeTest } from './components/TokenExchangeTest';
import { MessageSendTest } from './components/MessageSendTest';
import { WebhookTest } from './components/WebhookTest';
import type { EventLogEntry, SignupData, TokenData } from './types';

export default function MetaTestPage() {
  const [appId, setAppId] = useState('');
  const [configId, setConfigId] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  const addEvent = useCallback((type: string, data?: Record<string, unknown>) => {
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        data,
      },
    ]);
  }, []);

  const handleSignupComplete = useCallback((data: SignupData) => {
    setSignupData(data);
    addEvent('SIGNUP_COMPLETE', data as Record<string, unknown>);
  }, [addEvent]);

  const handleTokenReceived = useCallback((data: TokenData) => {
    setTokenData(data);
    addEvent('TOKEN_RECEIVED', { 
      token_preview: data.access_token.substring(0, 20) + '...' 
    });
  }, [addEvent]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Teste de Integração Meta WhatsApp API</h1>
        <p className="text-muted-foreground">
          Validar o fluxo do Embedded Signup antes da implementação final
        </p>
      </div>

      <div className="space-y-6">
        <MetaSdkLoader
          appId={appId}
          configId={configId}
          onAppIdChange={setAppId}
          onConfigIdChange={setConfigId}
          onSdkLoaded={setSdkLoaded}
          sdkLoaded={sdkLoaded}
        />

        <EmbeddedSignupTest
          configId={configId}
          sdkLoaded={sdkLoaded}
          events={events}
          onAddEvent={addEvent}
          onSignupComplete={handleSignupComplete}
        />

        <TokenExchangeTest
          signupData={signupData}
          onTokenReceived={handleTokenReceived}
        />

        <MessageSendTest
          signupData={signupData}
          tokenData={tokenData}
        />

        <WebhookTest tokenData={tokenData} />
      </div>
    </div>
  );
}
