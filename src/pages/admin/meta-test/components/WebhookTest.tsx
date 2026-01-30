import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { WebhookLogEntry, TokenData } from '../types';

interface WebhookTestProps {
  tokenData: TokenData | null;
}

export function WebhookTest({ tokenData }: WebhookTestProps) {
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;
  const verifyToken = 'julia_meta_verify_token_test_123';

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copiado!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-webhook', {
        method: 'POST',
        body: { action: 'get_logs' },
      });

      if (!error && data?.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tokenData?.access_token) {
      fetchLogs();
    }
  }, [tokenData]);

  const isEnabled = tokenData?.access_token;

  return (
    <Card className={!isEnabled ? 'opacity-50' : ''}>
      <CardHeader>
        <CardTitle className="text-lg">Etapa 5: Testar Webhook</CardTitle>
        <CardDescription>
          Configure o webhook no painel da Meta e verifique as mensagens recebidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL (Callback URL)</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, 'url')}
              >
                {copiedField === 'url' ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verify Token</Label>
            <div className="flex gap-2">
              <Input
                value={verifyToken}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(verifyToken, 'token')}
              >
                {copiedField === 'token' ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Últimas Mensagens Recebidas</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLogs}
              disabled={!isEnabled || isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Atualizar
            </Button>
          </div>
          <ScrollArea className="h-40 w-full rounded-md border bg-muted/30 p-3">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma mensagem recebida ainda
              </p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="text-xs font-mono p-2 rounded bg-background"
                  >
                    <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                    <span className="text-primary">De: {log.from}</span>{' '}
                    <span>| "{log.message}"</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="rounded-md bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            <strong>Como configurar:</strong>
          </p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside mt-2 space-y-1">
            <li>Acesse developers.facebook.com → seu App → WhatsApp → Configuration</li>
            <li>Em "Webhook", clique em "Edit"</li>
            <li>Cole a Callback URL e o Verify Token acima</li>
            <li>Clique em "Verify and Save"</li>
            <li>Subscreva o campo "messages"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
