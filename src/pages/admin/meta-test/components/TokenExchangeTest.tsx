import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Key, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SignupData, TokenData } from '../types';

interface TokenExchangeTestProps {
  signupData: SignupData | null;
  onTokenReceived: (tokenData: TokenData) => void;
}

export function TokenExchangeTest({
  signupData,
  onTokenReceived,
}: TokenExchangeTestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  const handleExchangeToken = async () => {
    if (!signupData?.code) {
      setError('Código de autorização não disponível');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-auth', {
        body: {
          code: signupData.code,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const token: TokenData = {
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
      };

      setTokenData(token);
      onTokenReceived(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao trocar token');
    } finally {
      setIsLoading(false);
    }
  };

  const isEnabled = signupData?.code;

  return (
    <Card className={!isEnabled ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Etapa 3: Trocar Token</CardTitle>
            <CardDescription>
              Trocar o código de autorização por um access token permanente
            </CardDescription>
          </div>
          {tokenData && (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Token Obtido
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleExchangeToken}
          disabled={!isEnabled || isLoading || !!tokenData}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Key className="mr-2 h-4 w-4" />
          )}
          {tokenData ? 'Token Obtido' : 'Testar Troca de Token'}
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {tokenData && (
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-sm font-mono break-all">
              <strong>Access Token:</strong>{' '}
              {tokenData.access_token.substring(0, 30)}...
            </p>
            <p className="text-sm">
              <strong>Tipo:</strong> {tokenData.token_type || 'Bearer'}
            </p>
            <p className="text-sm">
              <strong>Expira em:</strong>{' '}
              {tokenData.expires_in
                ? `${Math.floor(tokenData.expires_in / 86400)} dias`
                : 'Nunca (token permanente)'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
