import { useState } from 'react';
import { Info, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UaZapiClient } from '@/lib/uazapi';

interface StartConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  codAgent: string;
  onSuccess: () => void;
}

export function StartConversationDialog({
  open,
  onOpenChange,
  whatsappNumber,
  codAgent,
  onSuccess,
}: StartConversationDialogProps) {
  const { user: authUser } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);

    try {
      // 1. Get agent credentials to determine provider
      const agentResult = await externalDb.raw<{
        api_url: string;
        api_key: string;
        api_instance: string;
        hub: string;
        waba_id: string;
        waba_number_id: string;
      }>({
        query: `SELECT evo_url as api_url, evo_apikey as api_key, evo_instance as api_instance,
                       hub, waba_id, waba_number_id
                FROM agents WHERE cod_agent = $1 LIMIT 1`,
        params: [codAgent],
      });

      if (!agentResult || agentResult.length === 0) {
        throw new Error('Agente não encontrado');
      }

      const creds = agentResult[0];
      const provider = (creds.hub || 'uazapi') as 'uazapi' | 'waba';

      // 2. Send message
      const senderName = authUser?.name || 'Usuário';
      const messageText = `*${senderName}:*\n${message.trim()}`;

      if (provider === 'waba') {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_text',
            cod_agent: codAgent,
            to: whatsappNumber,
            text: messageText,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error.message || data.error);
      } else {
        if (!creds.api_url || !creds.api_key) {
          throw new Error('Credenciais UaZapi não configuradas');
        }
        const client = new UaZapiClient({
          baseUrl: creds.api_url,
          token: creds.api_key,
          instance: creds.api_instance,
        });
        await client.post('/send/text', {
          number: whatsappNumber,
          text: messageText,
        });
      }

      // 3. Create CRM card in "Atendimento Humano" stage
      try {
        // Find the stage
        const stageResult = await externalDb.raw<{ id: number }>({
          query: `SELECT id FROM crm_atendimento_stages WHERE LOWER(name) LIKE '%atendimento humano%' LIMIT 1`,
          params: [],
        });

        if (stageResult && stageResult.length > 0) {
          const stageId = stageResult[0].id;

          // Check if card already exists for this number/agent
          const existingCard = await externalDb.raw<{ id: number }>({
            query: `SELECT id FROM crm_atendimento_cards WHERE whatsapp_number = $1 AND cod_agent = $2 LIMIT 1`,
            params: [whatsappNumber, codAgent],
          });

          if (!existingCard || existingCard.length === 0) {
            // Create new card
            await externalDb.raw({
              query: `INSERT INTO crm_atendimento_cards (whatsapp_number, cod_agent, stage_id, owner_name, contact_name, created_at, updated_at, stage_entered_at)
                      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())`,
              params: [whatsappNumber, codAgent, stageId, authUser?.name || null, whatsappNumber],
            });
          } else {
            // Update existing card owner
            await externalDb.raw({
              query: `UPDATE crm_atendimento_cards SET owner_name = $1, stage_id = $2, stage_entered_at = NOW(), updated_at = NOW() WHERE whatsapp_number = $3 AND cod_agent = $4`,
              params: [authUser?.name || null, stageId, whatsappNumber, codAgent],
            });
          }
        }
      } catch (crmError) {
        console.warn('[CRM] Failed to create/update card:', crmError);
      }

      // 4. Create/update session as inactive (so it appears in the list)
      try {
        await externalDb.raw({
          query: `INSERT INTO julia_sessions (whatsapp_number, cod_agent, active, created_at, updated_at)
                  VALUES ($1, $2, false, NOW(), NOW())
                  ON CONFLICT (whatsapp_number, cod_agent) DO UPDATE SET active = false, updated_at = NOW()`,
          params: [whatsappNumber, codAgent],
        });
      } catch (sessionError) {
        console.warn('[Session] Failed to create/update session:', sessionError);
      }

      toast.success('Mensagem enviada com sucesso!');
      setMessage('');
      onSuccess();
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.error(`Erro ao enviar mensagem: ${error.message || 'Tente novamente'}`);
    } finally {
      setSending(false);
    }
  };

  const formattedNumber = whatsappNumber.length > 4
    ? `+${whatsappNumber.slice(0, 2)} (${whatsappNumber.slice(2, 4)}) ${whatsappNumber.slice(4)}`
    : whatsappNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar conversa</DialogTitle>
          <DialogDescription>
            Envie a primeira mensagem para <strong>{formattedNumber}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              A mensagem será enviada através do número de WhatsApp da Júlia IA do agente selecionado.
            </AlertDescription>
          </Alert>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a primeira mensagem..."
            className="min-h-[100px] text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!message.trim() || sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
