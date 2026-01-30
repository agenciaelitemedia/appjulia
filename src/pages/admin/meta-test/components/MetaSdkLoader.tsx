import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface MetaSdkLoaderProps {
  appId: string;
  configId: string;
  onAppIdChange: (value: string) => void;
  onConfigIdChange: (value: string) => void;
  onSdkLoaded: (loaded: boolean) => void;
  sdkLoaded: boolean;
}

export function MetaSdkLoader({
  appId,
  configId,
  onAppIdChange,
  onConfigIdChange,
  onSdkLoaded,
  sdkLoaded,
}: MetaSdkLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSdk = () => {
    if (!appId.trim()) {
      setError('App ID é obrigatório');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Remove any existing SDK script
    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.remove();
    }

    // Clear any existing FB object
    if (window.FB) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).FB = undefined;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });

      setIsLoading(false);
      onSdkLoaded(true);
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    
    script.onerror = () => {
      setIsLoading(false);
      setError('Falha ao carregar o SDK do Facebook');
      onSdkLoaded(false);
    };

    document.body.appendChild(script);
  };

  useEffect(() => {
    return () => {
      const script = document.getElementById('facebook-jssdk');
      if (script) {
        script.remove();
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Etapa 1: Configuração do App</CardTitle>
            <CardDescription>
              Informe as credenciais do seu App Meta aprovado
            </CardDescription>
          </div>
          {sdkLoaded ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              SDK Carregado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" />
              SDK Não Carregado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="appId">App ID</Label>
            <Input
              id="appId"
              placeholder="Seu Facebook App ID"
              value={appId}
              onChange={(e) => onAppIdChange(e.target.value)}
              disabled={sdkLoaded}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="configId">Config ID (Embedded Signup)</Label>
            <Input
              id="configId"
              placeholder="Configuration ID do Embedded Signup"
              value={configId}
              onChange={(e) => onConfigIdChange(e.target.value)}
              disabled={sdkLoaded}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={loadSdk}
          disabled={isLoading || sdkLoaded || !appId.trim()}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sdkLoaded ? 'SDK Carregado' : 'Carregar SDK'}
        </Button>
      </CardContent>
    </Card>
  );
}
