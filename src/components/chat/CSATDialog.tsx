import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';

interface CSATDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactId: string;
  clientId: string;
  codAgent?: string | null;
  onConfirm: (closeNote: string, sendSurvey: boolean) => Promise<void>;
}

const SURVEY_TEMPLATE = (protocol?: string) =>
  `Olá! Seu atendimento${protocol ? ` (${protocol})` : ''} foi encerrado. 🙏\n\n` +
  `Como você avalia a qualidade do nosso atendimento? Responda com uma nota:\n\n` +
  `5️⃣ Excelente\n4️⃣ Bom\n3️⃣ Regular\n2️⃣ Ruim\n1️⃣ Péssimo`;

export function CSATDialog({
  open,
  onOpenChange,
  conversationId,
  contactId,
  clientId,
  codAgent,
  onConfirm,
}: CSATDialogProps) {
  const [closeNote, setCloseNote] = useState('');
  const [sendSurvey, setSendSurvey] = useState(true);
  const [surveyText, setSurveyText] = useState(SURVEY_TEMPLATE());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state every time the dialog opens
  useEffect(() => {
    if (open) {
      setCloseNote('');
      setSendSurvey(true);
      setSurveyText(SURVEY_TEMPLATE());
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // Close conversation first
      await onConfirm(closeNote, sendSurvey);

      // Send survey if requested
      if (sendSurvey) {
        // Register CSAT placeholder (status pending until reply)
        await supabase.from('chat_csat_responses').insert({
          conversation_id: conversationId,
          contact_id: contactId,
          client_id: clientId,
          cod_agent: codAgent || null,
          score: 0, // 0 = not yet answered
          status: 'sent',
          survey_type: 'csat',
        });

        // Send the survey message via the standard send pipeline
        // We post directly to chat_messages — the realtime/sender hook will dispatch via the conversation channel
        // For simplicity here we trigger via send-message edge function pattern that the app already uses
        try {
          const { error: sendErr } = await supabase.functions.invoke('chat-send-message', {
            body: {
              conversation_id: conversationId,
              contact_id: contactId,
              text: surveyText,
            },
          });
          if (sendErr) throw sendErr;
        } catch (e) {
          // Fallback: insert outbound message — server-side trigger/worker will deliver
          await supabase.from('chat_messages').insert({
            contact_id: contactId,
            client_id: clientId,
            conversation_id: conversationId,
            text: surveyText,
            type: 'text',
            from_me: true,
            status: 'sending',
            timestamp: new Date().toISOString(),
            metadata: { csat_invite: true },
          });
        }
        toast.success('Pesquisa CSAT enviada');
      }

      onOpenChange(false);
      setCloseNote('');
      setSendSurvey(true);
      setSurveyText(SURVEY_TEMPLATE());
    } catch (e: any) {
      console.error('[CSAT] close failed', e);
      toast.error('Erro ao encerrar conversa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Encerrar conversa
          </DialogTitle>
          <DialogDescription>
            Adicione uma nota interna e, se desejar, envie uma pesquisa de satisfação ao cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nota interna do encerramento (opcional)</Label>
            <Textarea
              placeholder="Ex.: Cliente atendido — pedido confirmado."
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="send-csat" className="text-sm font-medium cursor-pointer">
                Enviar pesquisa de satisfação
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Cliente recebe uma mensagem para avaliar o atendimento (1 a 5).
              </p>
            </div>
            <Switch id="send-csat" checked={sendSurvey} onCheckedChange={setSendSurvey} />
          </div>

          {sendSurvey && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem da pesquisa</Label>
              <Textarea
                value={surveyText}
                onChange={(e) => setSurveyText(e.target.value)}
                rows={6}
                className={cn('text-xs font-mono')}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Encerrar{sendSurvey ? ' e enviar' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
