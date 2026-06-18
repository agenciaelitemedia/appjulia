import { useState, useEffect } from 'react';
import { Send, Loader2, Info, AlertTriangle, MessageSquare, Plus } from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  currentUser?: { codAgent: string; name: string };
}

interface ActiveConv {
  id: string;
  contact_id: string;
  queue_id: string | null;
  status: string;
  assigned_to: string | null;
  opened_at: string | null;
  protocol: string | null;
  channel: string;
}
interface ContactRow { id: string; name: string; phone: string }
interface ConflictState {
  convs: ActiveConv[];
  contacts: ContactRow[];
  queueNames: Record<string, string>;
}

export function NewConversationDialog({ open, onOpenChange, queues, initialPhone, initialName, lockContact, clientId, currentUser }: Props) {
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [name, setName] = useState(initialName ?? '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedQueue = queues.find(q => q.id === selectedQueueId) ?? null;

  useEffect(() => {
    if (open) {
      setPhone(initialPhone ?? '');
      setName(initialName ?? '');
      setConflict(null);
    }
  }, [open, initialPhone, initialName]);

  const handleClose = () => {
    if (sending) return;
    setSelectedQueueId('');
    setPhone(initialPhone ?? '');
    setName(initialName ?? '');
    setMessage('');
    setConflict(null);
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

  const checkConflicts = async (): Promise<ConflictState | null> => {
    if (!clientId) return null;
    const variants = brPhoneVariants(cleanPhone);
    if (variants.length === 0) return null;
    const { data: cts } = await supabase
      .from('chat_contacts')
      .select('id, name, phone')
      .eq('client_id', clientId)
      .in('phone', variants);
    const ids = (cts ?? []).map((c: any) => c.id as string);
    if (ids.length === 0) return null;
    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('id, contact_id, queue_id, status, assigned_to, opened_at, protocol, channel')
      .eq('client_id', clientId)
      .in('contact_id', ids)
      .in('status', ['pending', 'open'])
      .order('updated_at', { ascending: false });
    if (!convs || convs.length === 0) return null;
    const qIds = Array.from(new Set(convs.map((c: any) => c.queue_id).filter(Boolean) as string[]));
    let queueNames: Record<string, string> = {};
    if (qIds.length) {
      const { data: qs } = await supabase.from('queues').select('id, name').in('id', qIds);
      queueNames = Object.fromEntries((qs ?? []).map((q: any) => [q.id as string, q.name as string]));
    }
    return { convs: convs as ActiveConv[], contacts: (cts ?? []) as ContactRow[], queueNames };
  };

  const handleSend = async () => {
    if (!canSend || sending || !selectedQueue) return;
    setSending(true);
    try {
      // Pré-check: existe conversa pending/open p/ esse telefone neste cliente?
      const c = await checkConflicts();
      if (c) {
        setConflict(c);
        setSending(false);
        return;
      }
      await sendUaZapiMessage();
      toast.success('Mensagem enviada! A conversa aparecerá na lista em instantes.');
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

  const handleOpenExisting = (conv: ActiveConv) => {
    goToChatWithSelection(conv.contact_id, conv.queue_id);
    toast.success('Abrindo conversa existente…');
    handleClose();
  };

  const handleCloseAndStartNew = async () => {
    if (!selectedQueue || !conflict || !clientId || !currentUser?.codAgent) return;
    setSending(true);
    try {
      const targetQueueId = selectedQueue.id;
      const channelType = (selectedQueue as any) ? 'whatsapp_uazapi' : 'whatsapp_uazapi'; // dialog hoje só lida com uazapi
      const noteSuffix = ` [manual] Encerrada para novo atendimento na fila "${selectedQueue.name}" por ${currentUser.name}`;

      // 1) Encerra conversas em conflito (de qualquer fila, inclusive a mesma — a nova será criada limpa)
      const idsToClose = conflict.convs.map(c => c.id);
      if (idsToClose.length) {
        // Buscar close_note atual para concatenar (resolved não toca updated_at via trigger? aqui faremos manual update preservando)
        const { data: existing } = await supabase
          .from('chat_conversations')
          .select('id, close_note, updated_at')
          .in('id', idsToClose);
        for (const row of (existing ?? []) as any[]) {
          await supabase
            .from('chat_conversations')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              close_note: (row.close_note ?? '') + noteSuffix,
              updated_at: row.updated_at, // preserva leader (regra auto-resolve)
            })
            .eq('id', row.id);
          await supabase.from('chat_conversation_history').insert({
            conversation_id: row.id,
            action: 'manual_closed_for_new_conversation',
            actor_name: currentUser.name,
            notes: `Encerrada manualmente para novo atendimento na fila ${selectedQueue.name}`,
          });
        }
      }

      // 2) Garante o contato (find ou cria) para a fila escolhida
      let contactId: string | null = null;
      const { data: existingContact } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('client_id', clientId)
        .eq('channel_source', targetQueueId)
        .eq('phone', cleanPhone)
        .maybeSingle();
      if (existingContact?.id) {
        contactId = (existingContact as any).id as string;
      } else {
        // Reusa o primeiro contato encontrado (de outra fila) só para extrair o nome se útil
        const fallbackName = (conflict.contacts[0]?.name) || (name.trim() || cleanPhone);
        const { data: created, error: ce } = await supabase
          .from('chat_contacts')
          .insert({
            client_id: clientId,
            channel_source: targetQueueId,
            channel_type: channelType,
            phone: cleanPhone,
            name: name.trim() || fallbackName,
            remote_jid: `${cleanPhone}@s.whatsapp.net`,
          })
          .select('id')
          .single();
        if (ce) throw ce;
        contactId = (created as any).id as string;
      }

      // 3) Cria nova conversa já atribuída ao usuário atual
      const { data: newConv, error: ne } = await supabase
        .from('chat_conversations')
        .insert({
          client_id: clientId,
          contact_id: contactId,
          queue_id: targetQueueId,
          channel: channelType,
          status: 'open',
          assigned_to: currentUser.name || (currentUser.id ? String(currentUser.id) : null),
          assigned_user_id: currentUser.id ? Number(currentUser.id) : null,
          opened_at: new Date().toISOString(),
          protocol: '', // trigger generate_conversation_protocol preenche
        })
        .select('id, contact_id, queue_id')
        .single();
      if (ne) throw ne;

      // 4) Envia a mensagem
      await sendUaZapiMessage();

      // 5) Foca a nova conversa
      goToChatWithSelection((newConv as any).contact_id, (newConv as any).queue_id);
      toast.success('Novo atendimento criado e mensagem enviada.');
      handleClose();
    } catch (err: any) {
      toast.error('Falha ao encerrar/iniciar: ' + (err?.message || 'Tente novamente'));
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
          <DialogTitle>{conflict ? 'Atendimento já existe' : 'Novo atendimento'}</DialogTitle>
          <DialogDescription>
            {conflict
              ? 'Encontramos uma conversa ativa para este contato. Escolha como prosseguir.'
              : 'Inicie uma conversa enviando a primeira mensagem pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <div className="space-y-3">
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                Já existe {conflict.convs.length > 1 ? 'mais de uma conversa ativa' : 'uma conversa ativa'} para este telefone. Para evitar duplicidade, escolha abrir uma existente ou encerrá-la(s) e iniciar uma nova já atribuída a você.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {conflict.convs.map((cv) => {
                const ct = conflict.contacts.find(c => c.id === cv.contact_id);
                const qName = cv.queue_id ? (conflict.queueNames[cv.queue_id] ?? 'Fila') : 'Sem fila';
                const opened = cv.opened_at ? formatDistanceToNow(new Date(cv.opened_at), { addSuffix: true, locale: ptBR }) : '';
                return (
                  <div key={cv.id} className="border rounded-md p-2.5 text-sm flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{ct?.name || cleanPhone}</span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{cv.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Fila: <span className="text-foreground">{qName}</span>
                        {cv.assigned_to ? <> · Responsável: <span className="text-foreground">{cv.assigned_to}</span></> : <> · <span className="italic">sem responsável</span></>}
                      </div>
                      {opened && <div className="text-[11px] text-muted-foreground">Aberta {opened}</div>}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => handleOpenExisting(cv)} disabled={sending}>
                      Abrir
                    </Button>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConflict(null)} disabled={sending}>
                Voltar
              </Button>
              <Button
                onClick={handleCloseAndStartNew}
                disabled={sending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Encerrar e iniciar nova
              </Button>
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
