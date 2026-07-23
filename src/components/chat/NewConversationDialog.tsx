import { useState, useEffect } from 'react';
import { Send, Loader2, Info, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UaZapiClient } from '@/lib/uazapi/client';
import { supabase } from '@/integrations/supabase/client';
import { brPhoneVariants } from '@/lib/phoneNormalize';
import { setPendingSelection } from '@/lib/chat/pendingSelection';
import { useNavigate, useLocation } from 'react-router-dom';

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
  /** Client id of the current user (required to enable conflict pre-check). */
  clientId?: string;
  /** Current user (required to enable conflict pre-check + assignment). */
  currentUser?: { codAgent?: string; name: string; id?: number | string };
}

interface ActiveConv {
  id: string;
  contact_id: string;
  queue_id: string | null;
  status: string;
  assigned_to: string | null;
  assigned_user_id: number | null;
  opened_at: string | null;
  protocol: string | null;
  channel: string;
  updated_at: string | null;
}

export function NewConversationDialog({ open, onOpenChange, queues, initialPhone, initialName, lockContact, clientId, currentUser }: Props) {
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [name, setName] = useState(initialName ?? '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedQueue = queues.find(q => q.id === selectedQueueId) ?? null;
  const currentAssigneeName = (currentUser?.name || (currentUser?.id ? String(currentUser.id) : '')).trim();
  const currentAssigneeUserId = currentUser?.id != null && Number.isFinite(Number(currentUser.id))
    ? Number(currentUser.id)
    : null;

  useEffect(() => {
    if (open) {
      setPhone(initialPhone ?? '');
      setName(initialName ?? '');
      setBlockedBy(null);
    }
  }, [open, initialPhone, initialName]);

  const handleClose = () => {
    if (sending) return;
    setSelectedQueueId('');
    setPhone(initialPhone ?? '');
    setName(initialName ?? '');
    setMessage('');
    setBlockedBy(null);
    onOpenChange(false);
  };

  const cleanPhone = phone.replace(/\D/g, '');
  const canSend = !!selectedQueue && cleanPhone.length >= 8 && message.trim().length > 0;

  const sendUaZapiMessage = async () => {
    if (!selectedQueue) return;
    const client = new UaZapiClient({
      baseUrl: selectedQueue.evo_url,
      token: selectedQueue.evo_apikey,
      instance: selectedQueue.evo_instance,
    });
    await client.post('/send/text', {
      number: cleanPhone,
      text: message.trim(),
    });
  };

  /**
   * Busca contato existente por (client_id, variantes do telefone) e reutiliza,
   * ou cria um novo. Evita duplicate key no unique (phone, client_id).
   */
  const resolveOrCreateContact = async (targetQueueId: string): Promise<string> => {
    const channelType = 'whatsapp_uazapi';
    const variants = brPhoneVariants(cleanPhone);
    const { data: existing } = await supabase
      .from('chat_contacts')
      .select('id, channel_source')
      .eq('client_id', clientId!)
      .in('phone', variants.length ? variants : [cleanPhone])
      .order('updated_at', { ascending: false })
      .limit(1);
    if (existing && existing.length > 0) {
      const row: any = existing[0];
      if (row.channel_source !== targetQueueId) {
        await supabase
          .from('chat_contacts')
          .update({ channel_source: targetQueueId, channel_type: channelType })
          .eq('id', row.id);
      }
      return row.id as string;
    }
    const finalName = name.trim() || cleanPhone;
    const { data: created, error: ce } = await supabase
      .from('chat_contacts')
      .insert({
        client_id: clientId!,
        channel_source: targetQueueId,
        channel_type: channelType,
        phone: cleanPhone,
        name: finalName,
        remote_jid: `${cleanPhone}@s.whatsapp.net`,
      })
      .select('id')
      .single();
    if (ce) throw ce;
    return (created as any).id as string;
  };

  const isSameAssignee = (conv: ActiveConv): boolean => {
    if (currentAssigneeUserId != null && conv.assigned_user_id != null) {
      return conv.assigned_user_id === currentAssigneeUserId;
    }
    if (conv.assigned_to && currentAssigneeName) {
      return conv.assigned_to.trim().toLowerCase() === currentAssigneeName.toLowerCase();
    }
    return false;
  };

  const logHistory = async (conversation_id: string, action: string, notes: string) => {
    try {
      await supabase.from('chat_conversation_history').insert({
        conversation_id,
        action,
        actor_name: currentAssigneeName,
        user_id: currentAssigneeUserId,
        notes,
      });
    } catch { /* histórico é best-effort */ }
  };

  const handleSend = async () => {
    if (!canSend || sending || !selectedQueue) return;
    if (!clientId || !currentAssigneeName) {
      toast.error('Sessão de usuário indisponível.');
      return;
    }
    setSending(true);
    setBlockedBy(null);
    try {
      const targetQueueId = selectedQueue.id;
      const contactId = await resolveOrCreateContact(targetQueueId);

      // Busca conversas ativas (pending/open) desse contato
      const { data: activeConvs } = await supabase
        .from('chat_conversations')
        .select('id, contact_id, queue_id, status, assigned_to, assigned_user_id, opened_at, protocol, channel, updated_at')
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .in('status', ['pending', 'open'])
        .order('updated_at', { ascending: false });

      const latest = (activeConvs && activeConvs[0]) as ActiveConv | undefined;
      let targetConvId: string | null = null;

      if (latest && latest.status === 'open' && latest.assigned_to && !isSameAssignee(latest)) {
        // Bloqueado: em atendimento por outro usuário
        setBlockedBy(latest.assigned_to);
        setSending(false);
        return;
      }

      if (!latest) {
        // Cria nova conversa
        const { data: created, error: ne } = await supabase
          .from('chat_conversations')
          .insert({
            client_id: clientId,
            contact_id: contactId,
            queue_id: targetQueueId,
            channel: 'whatsapp_uazapi',
            status: 'open',
            assigned_to: currentAssigneeName,
            assigned_user_id: currentAssigneeUserId,
            opened_at: new Date().toISOString(),
            protocol: '',
          })
          .select('id')
          .single();
        if (ne) throw ne;
        targetConvId = (created as any).id as string;
        await logHistory(targetConvId, 'created_manual', `Novo atendimento criado na fila "${selectedQueue.name}"`);
      } else {
        // Reutiliza conversa existente (pending, ou open do próprio usuário / sem responsável)
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const notes: string[] = [];

        if (latest.status !== 'open') {
          patch.status = 'open';
          patch.opened_at = new Date().toISOString();
        }
        if (latest.queue_id !== targetQueueId) {
          patch.queue_id = targetQueueId;
          notes.push(`Fila alterada para "${selectedQueue.name}"`);
        }
        if (!isSameAssignee(latest)) {
          patch.assigned_to = currentAssigneeName;
          patch.assigned_user_id = currentAssigneeUserId;
          notes.push(`Atribuído a ${currentAssigneeName}`);
        }

        if (Object.keys(patch).length > 1) {
          const { error: ue } = await supabase
            .from('chat_conversations')
            .update(patch)
            .eq('id', latest.id);
          if (ue) throw ue;
          if (notes.length) {
            await logHistory(latest.id, 'reassigned_manual', notes.join(' · '));
          }
        }
        targetConvId = latest.id;
      }

      // Envia mensagem via UaZapi
      await sendUaZapiMessage();

      goToChatWithSelection(contactId, targetQueueId);
      toast.success('Atendimento aberto e mensagem enviada.');
      handleClose();
    } catch (err: any) {
      toast.error('Falha ao enviar: ' + (err?.message || 'Tente novamente'));
    } finally {
      setSending(false);
    }
  };

  const goToChatWithSelection = (contactId: string, queueId: string | null) => {
    setPendingSelection({ contactId, queueId });
    if (location.pathname !== '/chat') {
      navigate('/chat');
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
          <DialogTitle>{blockedBy ? 'Contato em atendimento' : 'Novo atendimento'}</DialogTitle>
          <DialogDescription>
            {blockedBy
              ? 'Este contato já está sendo atendido por outro usuário.'
              : 'Inicie uma conversa enviando a primeira mensagem pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        {blockedBy ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Este contato está em atendimento por <strong>{blockedBy}</strong>. Se você precisa falar com este número, o melhor é solicitar ao atendente <strong>{blockedBy}</strong> para transferir a conversa para você.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={handleClose}>OK</Button>
            </DialogFooter>
          </div>
        ) : (
          <>

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
