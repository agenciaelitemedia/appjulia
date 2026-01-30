import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SignupData, TokenData } from '../types';

interface MessageSendTestProps {
  signupData: SignupData | null;
  tokenData: TokenData | null;
}

export function MessageSendTest({
  signupData,
  tokenData,
}: MessageSendTestProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('Teste da Julia via Meta API 🚀');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);

  const handleSendMessage = async () => {
    if (!tokenData?.access_token || !signupData?.phone_number_id) {
      setResult({ success: false, error: 'Token ou Phone Number ID não disponível' });
      return;
    }

    if (!phoneNumber.trim()) {
      setResult({ success: false, error: 'Número de destino é obrigatório' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-send-test', {
        body: {
          accessToken: tokenData.access_token,
          phoneNumberId: signupData.phone_number_id,
          to: phoneNumber.replace(/\D/g, ''),
          message: message,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      setResult({ success: true, data });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao enviar mensagem',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isEnabled = tokenData?.access_token && signupData?.phone_number_id;

  return (
    <Card className={!isEnabled ? 'opacity-50' : ''}>
      <CardHeader>
        <CardTitle className="text-lg">Etapa 4: Testar Envio de Mensagem</CardTitle>
        <CardDescription>
          Validar que o token funciona enviando uma mensagem de teste
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Destino</Label>
            <Input
              id="phoneNumber"
              placeholder="+55 11 99999-9999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={!isEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Mensagem de teste..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isEnabled}
              rows={2}
            />
          </div>
        </div>

        <Button
          onClick={handleSendMessage}
          disabled={!isEnabled || isLoading || !phoneNumber.trim()}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Enviar Mensagem de Teste
        </Button>

        {result && (
          <div
            className={`flex items-start gap-2 p-3 rounded-md ${
              result.success
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {result.success ? (
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <div className="text-sm">
              {result.success ? (
                <>
                  <p className="font-medium">Mensagem enviada com sucesso!</p>
                  {result.data && (
                    <pre className="mt-1 text-xs font-mono overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <p>{result.error}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
