import { useState } from 'react';
import { Video, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCreateVideoRoom } from '../hooks/useVideoRoom';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  codAgent: string;
  whatsappNumber: string;
  contactName?: string;
  apiCredentials?: {
    apiUrl: string;
    apiKey: string;
    apiInstance: string;
  };
}

export function VideoCallDialog({
  open,
  onOpenChange,
  leadId,
  codAgent,
  whatsappNumber,
  contactName,
  apiCredentials,
}: VideoCallDialogProps) {
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const createRoom = useCreateVideoRoom();

  const defaultMessage = `Olá${contactName ? ` ${contactName}` : ''}! 👋

Preparamos uma videochamada exclusiva para você. Clique no link abaixo para entrar:

{ROOM_URL}

*Não precisa baixar nenhum aplicativo*, a chamada abre direto no navegador! 📱💻

Estamos te aguardando! 🎥`;

  const handleSend = async () => {
    setIsSending(true);
    
    try {
      // Create the video room
      const room = await createRoom.mutateAsync({
        leadId,
        codAgent,
        whatsappNumber,
        contactName,
      });

      // Prepare the message with room URL
      const messageText = (customMessage || defaultMessage).replace('{ROOM_URL}', room.url);

      // Send via WhatsApp (UaZapi)
      if (apiCredentials) {
        const response = await fetch(`${apiCredentials.apiUrl}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiCredentials.apiKey}`,
          },
          body: JSON.stringify({
            instance: apiCredentials.apiInstance,
            number: whatsappNumber,
            text: messageText,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send WhatsApp message');
        }
      }

      toast.success('Link de videochamada enviado!', {
        description: `Aguardando ${contactName || whatsappNumber} entrar na sala.`,
      });
      
      onOpenChange(false);
      setCustomMessage('');
    } catch (error) {
      console.error('Error sending video call:', error);
      toast.error('Erro ao enviar link de videochamada');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Iniciar Videochamada
          </DialogTitle>
          <DialogDescription>
            Um link será criado e enviado para {contactName || whatsappNumber} via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              placeholder={defaultMessage}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{'{ROOM_URL}'}</code> para inserir o link da sala automaticamente.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <p className="text-sm font-medium">Detalhes do lead:</p>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>📱 WhatsApp: {whatsappNumber}</p>
              {contactName && <p>👤 Nome: {contactName}</p>}
              <p>🏷️ Agente: {codAgent}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
