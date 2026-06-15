import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChatSidePanel, type ChatSidePanelTarget } from '@/components/chat/ChatSidePanel';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Send, StickyNote, MessageSquare, Star, MessageCircle, Trash2, X as XIcon,
  Activity, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTicket, useTicketMutations, useTicketRole, useSupportConfig, WhatsappDispatchError } from './hooks/useTickets';
import { TicketSlaBadge } from './components/TicketSlaBadge';
import { TicketTimeline } from './components/TicketTimeline';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import {
  STATUS_LABEL, STATUS_BADGE, STATUS_ORDER, PRIORITY_LABEL, PRIORITY_BADGE,
  type TicketStatus, type TicketPriority,
} from './types';
import type { TicketMessage } from './types';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const role = useTicketRole();
  const { ticket, messages, isLoading } = useTicket(id);
  const { reply, editMessage, deleteMessage, setStatus, update, setCsat, deleteTicket, assign } = useTicketMutations();
  const { departments, categories } = useSupportConfig();
  const { data: team } = useTeamByClient();
  const teamMembers: TeamMemberOption[] = (team || []).map((m) => ({
    id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo,
  }));
  const deptName = (id: string | null | undefined) => departments.find((d) => d.id === id)?.name ?? '—';
  const catName  = (id: string | null | undefined) => categories.find((c) => c.id === id)?.name ?? '—';

  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [pastedImage, setPastedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [csat, setCsatScore] = useState(0);
  const [csatComment, setCsatComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<TicketMessage | null>(null);

  // Cleanup do objectURL quando trocar/remover a imagem
  useEffect(() => {
    return () => {
      if (pastedImage?.previewUrl) URL.revokeObjectURL(pastedImage.previewUrl);
    };
  }, [pastedImage?.previewUrl]);

  // Resolve queue_id do ticket: via conversation_id se houver, senão pega a
  // conversa mais recente do contato.
  const { data: chatTarget, isLoading: isChatTargetLoading } = useQuery({
    queryKey: ['ticket-chat-target', ticket?.id, ticket?.conversation_id, ticket?.contact_id],
    enabled: !!ticket?.contact_id,
    staleTime: 60_000,
    queryFn: async (): Promise<ChatSidePanelTarget | null> => {
      if (!ticket?.contact_id) return null;
      let conversationId = ticket.conversation_id ?? null;
      let queueId: string | null = null;
      if (conversationId) {
        const { data } = await supabase
          .from('chat_conversations')
          .select('id, queue_id')
          .eq('id', conversationId)
          .maybeSingle();
        queueId = (data?.queue_id as string | null) ?? null;
      }
      if (!queueId) {
        const { data } = await supabase
          .from('chat_conversations')
          .select('id, queue_id')
          .eq('contact_id', ticket.contact_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          queueId = (data.queue_id as string | null) ?? null;
          if (!conversationId) conversationId = (data.id as string) ?? null;
        }
      }
      return { contactId: ticket.contact_id, queueId, conversationId };
    },
  });

  const isAgent = role === 'agent';
  const currentUserId = user?.id != null ? String(user.id) : null;

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!ticket) return <div className="text-center text-muted-foreground py-12">Chamado não encontrado.</div>;

  // Solicitante não vê notas internas
  const visibleMessages = messages.filter((m) => isAgent || m.kind !== 'internal');

  // Última mensagem (resposta/nota) do usuário atual, dentro de 15min e editável
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const lastEditable = (() => {
    const own = visibleMessages
      .filter(
        (m) =>
          m.kind !== 'event' &&
          m.author_user_id != null &&
          currentUserId != null &&
          String(m.author_user_id) === currentUserId,
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const m = own[0];
    if (!m) return null;
    if (Date.now() - new Date(m.created_at).getTime() > EDIT_WINDOW_MS) return null;
    return m;
  })();

  const canEditMessage = (m: TicketMessage) => !!lastEditable && m.id === lastEditable.id;

  const handleSaveEdit = async (m: TicketMessage) => {
    if (!id || !editDraft.trim()) return;
    try {
      await editMessage.mutateAsync({ ticketId: id, messageId: m.id, body: editDraft.trim() });
      setEditingId(null);
      setEditDraft('');
      toast.success('Mensagem atualizada');
    } catch {
      toast.error('Erro ao editar mensagem');
    }
  };

  const handleDeleteMessage = async () => {
    if (!id || !deleteMsg) return;
    try {
      await deleteMessage.mutateAsync({
        ticketId: id,
        messageId: deleteMsg.id,
        kind: deleteMsg.kind as 'public' | 'internal',
      });
      toast.success('Mensagem excluída');
    } catch {
      toast.error('Erro ao excluir mensagem');
    } finally {
      setDeleteMsg(null);
    }
  };

  const handleSend = async () => {
    if ((!draft.trim() && !pastedImage) || !id) return;
    setSending(true);
    const wantsWhatsApp =
      sendWhatsApp && !internal && !!chatTarget?.queueId && !!chatTarget?.contactId;
    try {
      await reply.mutateAsync({
        ticketId: id,
        body: draft.trim(),
        internal: internal && isAgent,
        attachment: pastedImage?.file ?? null,
        sendToWhatsApp: wantsWhatsApp
          ? {
              contactId: chatTarget!.contactId!,
              queueId: chatTarget!.queueId!,
              conversationId: chatTarget!.conversationId ?? null,
            }
          : undefined,
      });
      setDraft('');
      setInternal(false);
      setSendWhatsApp(false);
      if (pastedImage?.previewUrl) URL.revokeObjectURL(pastedImage.previewUrl);
      setPastedImage(null);
      if (wantsWhatsApp) toast.success('Resposta registrada e enviada ao WhatsApp');
    } catch (err) {
      if (err instanceof WhatsappDispatchError) {
        toast.success('Resposta registrada no chamado');
        toast.error(`Falha ao enviar WhatsApp: ${err.message}`);
        setDraft('');
        setInternal(false);
        setSendWhatsApp(false);
        if (pastedImage?.previewUrl) URL.revokeObjectURL(pastedImage.previewUrl);
        setPastedImage(null);
      } else {
        toast.error('Erro ao enviar resposta');
      }
    } finally { setSending(false); }
  };

  const submitCsat = async () => {
    if (!id || csat < 1) { toast.error('Selecione de 1 a 5'); return; }
    await setCsat.mutateAsync({ ticketId: id, score: csat, comment: csatComment.trim() || undefined });
    toast.success('Obrigado pela avaliação!');
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteTicket.mutateAsync(id);
      toast.success('Chamado excluído com sucesso');
      navigate('/tickets');
    } catch {
      toast.error('Erro ao excluir chamado');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tickets')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">#{ticket.protocol ?? ticket.number} · {ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">
            {ticket.protocol && ticket.number != null && <span className="font-mono mr-2">Nº interno #{ticket.number}</span>}
            Aberto em {ticket.opened_at ? format(new Date(ticket.opened_at), 'dd/MM/yyyy HH:mm') : '—'}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
            title="Excluir chamado"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Coluna esquerda: detalhes + histórico */}
        <Card className="lg:col-span-1 h-fit">
          <Tabs defaultValue="detalhes" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="historico" className="gap-1">
                  <Activity className="h-3.5 w-3.5" /> Histórico
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-2">
              <TabsContent value="detalhes" className="space-y-3 text-sm mt-0">
                <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
              <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
              <TicketSlaBadge ticket={ticket} />
            </div>

            {isAgent ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Select value={ticket.status} onValueChange={(v) => setStatus.mutate({ ticketId: ticket.id, status: v as TicketStatus })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Prioridade</span>
                  <Select value={ticket.priority} onValueChange={(v) => update.mutate({ ticketId: ticket.id, patch: { priority: v }, event: `Prioridade: ${v}` })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Departamento</span>
                  <Select value={ticket.department_id ?? ''} onValueChange={(v) => update.mutate({ ticketId: ticket.id, patch: { department_id: v }, event: `Departamento: ${deptName(v)}` })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Categoria</span>
                  <Select value={ticket.category_id ?? ''} onValueChange={(v) => update.mutate({ ticketId: ticket.id, patch: { category_id: v }, event: `Categoria: ${catName(v)}` })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{categories.filter((c) => !c.department_id || c.department_id === ticket.department_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Responsável</span>
                  <TeamMemberSelect
                    members={teamMembers}
                    value={ticket.assigned_to_name ?? null}
                    onValueChange={(name) => {
                      const m = teamMembers.find((x) => x.name === name);
                      assign.mutate({
                        ticketId: ticket.id,
                        assignedTo: m ? String(m.id) : null,
                        assignedToName: m?.name ?? null,
                      });
                    }}
                    valueKey="name"
                    allowUnassigned
                    showCurrentUserShortcut
                    placeholder="Selecione um responsável…"
                    className="w-full"
                  />
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-muted-foreground">Solicitante</p>
              <p className="font-medium">{ticket.requester_name || '—'}</p>
              {ticket.requester_email && <p className="text-xs text-muted-foreground">{ticket.requester_email}</p>}
              {ticket.requester_phone && <p className="text-xs text-muted-foreground">{ticket.requester_phone}</p>}
            </div>

            {ticket.contact_id && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={() => setChatPanelOpen(true)}
                disabled={isChatTargetLoading}
              >
                <MessageCircle className="h-4 w-4" /> Abrir conversa
              </Button>
            )}

            {/* CSAT do solicitante quando resolvido */}
            {!isAgent && ['resolved', 'closed'].includes(ticket.status) && !ticket.csat_score && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-medium">Avalie o atendimento</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setCsatScore(n)} aria-label={`${n} estrelas`}>
                      <Star className={cn('h-5 w-5', n <= csat ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                    </button>
                  ))}
                </div>
                <Input value={csatComment} onChange={(e) => setCsatComment(e.target.value)} placeholder="Comentário (opcional)" />
                <Button size="sm" className="w-full" onClick={submitCsat}>Enviar avaliação</Button>
              </div>
            )}
            {ticket.csat_score && (
              <div className="pt-2 border-t text-sm">
                <span className="text-xs text-muted-foreground">Avaliação: </span>
                <span className="font-medium">{ticket.csat_score}/5</span>
                {ticket.csat_comment && <p className="text-xs text-muted-foreground mt-0.5">"{ticket.csat_comment}"</p>}
              </div>
            )}
              </TabsContent>

              <TabsContent value="historico" className="mt-0 max-h-[70vh] overflow-y-auto pr-1">
                <TicketTimeline messages={messages.filter((m) => m.kind === 'event')} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Coluna direita: sobre + interações + composer */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardContent className="flex-1 flex flex-col gap-4 pt-6">
            {/* Sobre este chamado */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sobre este chamado</p>
              <p className="font-medium">{ticket.subject}</p>
              {ticket.description && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
              )}
            </div>

            {/* Composer */}
            <div className="space-y-2">
              {isAgent && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={internal ? 'outline' : 'default'} onClick={() => setInternal(false)}>
                    <MessageSquare className="h-4 w-4 mr-1" /> Resposta
                  </Button>
                  <Button type="button" size="sm" variant={internal ? 'default' : 'outline'} onClick={() => setInternal(true)}>
                    <StickyNote className="h-4 w-4 mr-1" /> Nota interna
                  </Button>
                </div>
              )}
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.kind === 'file' && it.type.startsWith('image/')) {
                      const f = it.getAsFile();
                      if (f) {
                        e.preventDefault();
                        if (pastedImage?.previewUrl) URL.revokeObjectURL(pastedImage.previewUrl);
                        setPastedImage({ file: f, previewUrl: URL.createObjectURL(f) });
                      }
                      break;
                    }
                  }
                }}
                placeholder={internal ? 'Nota interna (não visível ao solicitante)' : 'Escreva uma resposta…'}
                className="min-h-[70px]"
              />
              {pastedImage && (
                <div className="relative inline-block">
                  <img
                    src={pastedImage.previewUrl}
                    alt="Imagem colada"
                    className="max-h-32 rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(pastedImage.previewUrl);
                      setPastedImage(null);
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow flex items-center justify-center hover:bg-muted"
                    aria-label="Remover imagem"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {isAgent && !internal ? (
                  (() => {
                    const hasChannel = !!chatTarget?.queueId && !!chatTarget?.contactId;
                    const disabled = !hasChannel || isChatTargetLoading || sending;
                    const reason = isChatTargetLoading
                      ? 'Carregando canal…'
                      : !hasChannel
                        ? 'Chamado sem conversa de WhatsApp vinculada'
                        : 'Também envia a resposta ao WhatsApp do solicitante pela fila do chamado';
                    return (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Switch
                                id="send-whatsapp"
                                checked={sendWhatsApp && hasChannel}
                                onCheckedChange={setSendWhatsApp}
                                disabled={disabled}
                              />
                              <Label htmlFor="send-whatsapp" className="text-xs cursor-pointer">
                                Enviar para WhatsApp
                              </Label>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{reason}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()
                ) : <span />}
                <Button onClick={handleSend} disabled={sending || (!draft.trim() && !pastedImage)}>
                  <Send className="h-4 w-4 mr-1" /> {sending ? 'Enviando…' : internal ? 'Salvar nota' : 'Responder'}
                </Button>
              </div>
            </div>

            {/* Interações (após o composer) */}
            <div className="space-y-2 border-t pt-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" /> Histórico de Conversa
              </h3>
              <div className="max-h-[55vh] overflow-y-auto pr-1">
                {(() => {
                  const interactions = visibleMessages.filter((m) => m.kind !== 'event');
                  if (interactions.length === 0) {
                    return <p className="text-xs text-muted-foreground py-8 text-center">Sem respostas ou notas ainda.</p>;
                  }
                  return (
                    <TicketTimeline
                      messages={interactions}
                      edit={{
                        editingId,
                        editDraft,
                        setEditingId,
                        setEditDraft,
                        canEditMessage,
                        onSaveEdit: handleSaveEdit,
                        onDelete: (m) => setDeleteMsg(m),
                        saving: editMessage.isPending,
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dupla confirmação de exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o chamado <strong>#{ticket.number} · {ticket.subject}</strong>? Esta ação não pode ser desfeita e todas as mensagens associadas serão permanentemente removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTicket.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTicket.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTicket.isPending ? 'Excluindo…' : 'Sim, excluir chamado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMsg} onOpenChange={(o) => !o && setDeleteMsg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta {deleteMsg?.kind === 'internal' ? 'nota interna' : 'resposta'}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMessage.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={deleteMessage.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMessage.isPending ? 'Excluindo…' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChatSidePanel
        open={chatPanelOpen}
        onOpenChange={setChatPanelOpen}
        target={chatTarget ?? null}
        isLoading={isChatTargetLoading}
        title={`Conversa do chamado #${ticket.number ?? ''}`}
        emptyDescription="Este chamado não está vinculado a uma conversa de chat."
      />
    </div>
  );
}
