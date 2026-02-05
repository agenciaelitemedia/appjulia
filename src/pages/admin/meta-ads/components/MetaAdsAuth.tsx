import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Facebook, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MetaAdsAuthProps {
  onTokenReceived: (token: string) => void;
  accessToken: string | null;
}

const META_APP_ID = '1182041896682498'; // Same as used in meta-test

export function MetaAdsAuth({ onTokenReceived, accessToken }: MetaAdsAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const handleFacebookLogin = () => {
    if (!window.FB) {
      toast.error('Facebook SDK não carregado. Aguarde ou recarregue a página.');
      return;
    }

    setIsLoading(true);

    // Use standard FB.login for Marketing API permissions
    // Note: Marketing API requires specific permissions that are requested via scope
    const loginOptions = {
      response_type: 'token',
    } as Parameters<typeof window.FB.login>[1];
    
    window.FB.login(
      (response) => {
        setIsLoading(false);
        
        if (response.authResponse?.accessToken) {
          onTokenReceived(response.authResponse.accessToken);
          toast.success('Autenticado com sucesso!');
        } else if (response.authResponse?.code) {
          // Exchange code for token
          exchangeCodeForToken(response.authResponse.code);
        } else {
          toast.error('Login cancelado ou falhou');
        }
      },
      {
        scope: 'ads_read,ads_management,business_management',
        response_type: 'token',
      }
    );
  };

  const exchangeCodeForToken = async (code: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-auth', {
        body: { code },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.access_token) {
        onTokenReceived(data.access_token);
        toast.success('Token obtido com sucesso!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao trocar código';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualToken = () => {
    if (manualCode.trim()) {
      if (manualCode.startsWith('EAA')) {
        // It's already a token
        onTokenReceived(manualCode.trim());
        toast.success('Token aplicado!');
      } else {
        // It's a code, exchange it
        exchangeCodeForToken(manualCode.trim());
      }
      setManualCode('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5" />
          Autenticação Meta Ads
        </CardTitle>
        <CardDescription>
          Conecte sua conta do Facebook para acessar dados de campanhas e anúncios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accessToken ? (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Autenticado</p>
              <p className="text-xs text-muted-foreground font-mono">
                {accessToken.substring(0, 20)}...{accessToken.substring(accessToken.length - 10)}
              </p>
            </div>
            <Badge variant="secondary">Conectado</Badge>
          </div>
        ) : (
          <>
            <Button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Facebook className="h-4 w-4 mr-2" />
              )}
              Conectar com Facebook
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-token">Token/Código Manual</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-token"
                  placeholder="Cole o access_token ou código aqui"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
                <Button onClick={handleManualToken} disabled={!manualCode.trim() || isLoading}>
                  Aplicar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Você pode obter um token no{' '}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Graph API Explorer
                </a>
              </p>
            </div>
          </>
        )}

        {!window.FB && !accessToken && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Carregando Facebook SDK...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
