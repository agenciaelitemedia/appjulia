import { useState, useEffect } from 'react';
import { Send, Loader2, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UaZapiClient } from '@/lib/uazapi/client';

interface Queue {
  id: string;
  name: string;
  evo_url: string;
  evo_apikey: string;
  evo_instance: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  queues: Queue[];
  initialPhone?: string;
  initialName?: string;
  /** When true, phone and name fields become read-only (used by CRM card flow). */
  lockContact?: boolean;
}

export function NewConversationDialog({ open, onOpenChange, queues, initialPhone, initialName, lockContact }: Props) {
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [name, setName] = useState(initialName ?? '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const selectedQueue = queues.find(q => q.id === selectedQueueId) ?? null;

  useEffect(() => {
    if (open) {
      setPhone(initialPhone ?? '');
      setName(initialName ?? '');
    }
  }, [open, initialPhone, initialName]);

  const handleClose = () => {
    if (sending) return;
    setSelectedQueueId('');
    setPhone(initialPhone ?? '');
    setName(initialName ?? '');
    setMessage('');
    onOpenChange(false);
  };

  const cleanPhone = phone.replace(/\D/g, '');
  const canSend = !!selectedQueue && cleanPhone.length >= 8 && message.trim().length > 0;

  const handleSend = async () => {
    if (!canSend || sending || !selectedQueue) return;
    setSending(true);
    try {
      const client = new UaZapiClient({
        baseUrl: selectedQueue.evo_url,
        token: selectedQueue.evo_apikey,
        instance: selectedQueue.evo_instance,
      });
      await client.post('/send/text', {
        number: cleanPhone,
        text: message.trim(),
      });
      toast.success('Mensagem enviada! A conversa aparecerá na lista em instantes.');
      handleClose();
    } catch (err: any) {
      toast.error('Falha ao enviar: ' + (err?.message || 'Tente novamente'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>
            Inicie uma conversa enviando a primeira mensagem pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              A conversa será criada automaticamente após o envio. Selecione a fila (número de WhatsApp) pelo qual a mensagem será enviada.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="nc-queue" className="text-sm">
              Fila <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
              <SelectTrigger id="nc-queue" className="text-sm">
                <SelectValue placeholder="Selecione a fila..." />
              </SelectTrigger>
              <SelectContent>
                {queues.length === 0 ? (
                  <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                    Nenhuma fila WhatsApp disponível
                  </div>
                ) : (
                  queues.map(q => (
                    <SelectItem key={q.id} value={q.id} className="text-sm">
                      {q.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-phone" className="text-sm">
              Telefone (WhatsApp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="5511999999999"
              className="text-sm font-mono"
              readOnly={lockContact}
              disabled={lockContact}
            />
            <p className="text-[11px] text-muted-foreground">
              {lockContact ? 'Telefone do contato vinculado ao card.' : 'Somente números com código do país (ex: 5511999999999)'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-name" className="text-sm">
              Nome do lead {!lockContact && <span className="text-muted-foreground text-[11px]">(opcional — usa o número se não informado)</span>}
            </Label>
            <Input
              id="nc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do contato"
              className="text-sm"
              readOnly={lockContact}
              disabled={lockContact}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-msg" className="text-sm">
              Mensagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="nc-msg"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Digite a mensagem inicial..."
              className="min-h-[100px] text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Conversar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
