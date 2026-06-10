import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, LifeBuoy, Loader2, ExternalLink, Trash2,
  MessageSquare, StickyNote, Send, History, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import {
  useTicket, useTicketMutations, useSupportConfig, useTicketRole, WhatsappDispatchError,
} from '@/pages/tickets/hooks/useTickets';
import { useTicketChatTarget } from '@/pages/tickets/hooks/useTicketChatTarget';
import {
  PRIORITY_LABEL, STATUS_LABEL, STATUS_BADGE,
  type TicketPriority, type TicketStatus, type TicketMessage,
} from '@/pages/tickets/types';
import { TicketTimeline } from '@/pages/tickets/components/TicketTimeline';

interface Props {
  open: boolean;
  onClose: () => void;
  ticketId: string;
}

/**
 * Painel lateral de detalhes/edição de um ticket existente, aberto a partir
 * da lista de conversas. Usa as mesmas mutations do módulo /tickets, então
 * o trigger DB mantém o vínculo `active_ticket_id` da conversa coerente.
 */
export function ChatTicketDetailSidePanel({ open, onClose, ticketId }: Props) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed top-0 right-0 h-full w-full sm:w-[460px] z-40 bg-background border-l shadow-2xl flex flex-col"
      role="dialog"
      aria-label="Detalhes do chamado"
    >
      <Body ticketId={ticketId} onClose={onClose} />
    </div>,
    document.body,
  );
}

function Body({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission('support_tickets', 'edit');
  const canDelete = hasPermission('support_tickets', 'delete');
  const role = useTicketRole();
  const isAgent = role === 'agent';
  const currentUserId = user?.id != null ? String(user.id) : null;

  const { ticket, messages, isLoading } = useTicket(ticketId);
  const { departments, categories } = useSupportConfig();
  const {
    update, setStatus, assign, deleteTicket,
    reply, editMessage, deleteMessage,
  } = useTicketMutations();
  const { data: team = [] } = useTeamByClient();
  const { data: chatTarget, isLoading: isChatTargetLoading } = useTicketChatTarget(ticket);

  const memberOptions: TeamMemberOption[] = useMemo(
    () => (team || []).map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, photo: m.photo })),
    [team],
  );

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<0 | 1 | 2>(0);
  const [confirmResolveOpen, setConfirmResolveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [allowDelete, setAllowDelete] = useState(false);

  useEffect(() => {
    if (!deleteOpen) {
      setDeleteConfirmText('');
      setAllowDelete(false);
    }
  }, [deleteOpen]);

  // Composer (aba Conversas)
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<TicketMessage | null>(null);

  // Hidrata o formulário quando o ticket carrega
  useEffect(() => {
    if (!ticket) return;
    setSubject(ticket.subject || '');
    setDescription(ticket.description || '');
    setPriority(ticket.priority);
    setDepartmentId(ticket.department_id || '');
    setCategoryId(ticket.category_id || '');
    setAssignedName(ticket.assigned_to_name || null);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deptCategories = useMemo(
    () => categories.filter((c) => !c.department_id || c.department_id === departmentId),
    [categories, departmentId],
  );

  const handleSave = async () => {
    if (!ticket) return;
    if (!canEdit) {
      toast.error('Você não tem permissão para editar este chamado.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Informe o assunto');
      return;
    }
    setSaving(true);
    try {
      // Atribuição (assign separado, dispara log próprio)
      const newAssigned = assignedName
        ? team.find((m) => (m.name || '').trim() === assignedName.trim()) || null
        : null;
      const newAssignedId = newAssigned ? String(newAssigned.id) : null;
      const newAssignedName = newAssigned ? newAssigned.name : null;
      if (newAssignedId !== (ticket.assigned_to ?? null) || newAssignedName !== (ticket.assigned_to_name ?? null)) {
        await assign.mutateAsync({ ticketId, assignedTo: newAssignedId, assignedToName: newAssignedName });
      }

      const patch: Record<string, unknown> = {};
      if (subject.trim() !== (ticket.subject || '')) patch.subject = subject.trim();
      if ((description || '') !== (ticket.description || '')) patch.description = description.trim() || null;
      if (priority !== ticket.priority) patch.priority = priority;
      if ((departmentId || null) !== (ticket.department_id || null)) patch.department_id = departmentId || null;
      if ((categoryId || null) !== (ticket.category_id || null)) patch.category_id = categoryId || null;

      if (Object.keys(patch).length > 0) {
        await update.mutateAsync({ ticketId, patch, event: 'Detalhes do chamado atualizados' });
      }
      toast.success('Chamado atualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar chamado');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: TicketStatus) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para alterar o status.');
      return;
    }
    try {
      await setStatus.mutateAsync({ ticketId, status });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      await deleteTicket.mutateAsync(ticketId);
      toast.success('Chamado excluído');
      setDeleteOpen(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir chamado');
    }
  };

  const isClosed = ticket && ['resolved', 'closed'].includes(ticket.status);

  const visibleMessages = (messages ?? []).filter((m) => isAgent || m.kind !== 'internal');
  const interactions = visibleMessages.filter((m) => m.kind !== 'event');
  const events = (messages ?? []).filter((m) => m.kind === 'event');

  // Edição: última mensagem própria, janela de 15min
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const lastEditable = (() => {
    const own = interactions
      .filter(
        (m) =>
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
    if (!editDraft.trim()) return;
    try {
      await editMessage.mutateAsync({ ticketId, messageId: m.id, body: editDraft.trim() });
      setEditingId(null);
      setEditDraft('');
      toast.success('Mensagem atualizada');
    } catch {
      toast.error('Erro ao editar mensagem');
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMsg) return;
    try {
      await deleteMessage.mutateAsync({
        ticketId,
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
    if (!draft.trim()) return;
    setSending(true);
    const wantsWhatsApp =
      sendWhatsApp && !internal && !!chatTarget?.queueId && !!chatTarget?.contactId;
    try {
      await reply.mutateAsync({
        ticketId,
        body: draft.trim(),
        internal: internal && isAgent,
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
      if (wantsWhatsApp) toast.success('Resposta registrada e enviada ao WhatsApp');
      else toast.success(internal ? 'Nota interna salva' : 'Resposta registrada');
    } catch (err) {
      if (err instanceof WhatsappDispatchError) {
        toast.success('Resposta registrada no chamado');
        toast.error(`Falha ao enviar WhatsApp: ${err.message}`);
        setDraft('');
        setInternal(false);
        setSendWhatsApp(false);
      } else {
        toast.error('Erro ao enviar resposta');
      }
    } finally { setSending(false); }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <LifeBuoy className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            {ticket?.number != null ? `Ticket #${ticket.number}` : 'Detalhes do chamado'}
          </span>
          {ticket && (
            <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {ticket && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(`/tickets/${ticket.id}`, '_blank', 'noopener')}
              title="Abrir no módulo de chamados"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading || !ticket ? (
        <div className="flex-1 flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="dados" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 mx-4 mt-3 flex-shrink-0">
            <TabsTrigger value="dados">Dados do Ticket</TabsTrigger>
            <TabsTrigger value="conversas">Conversas</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1">
              <History className="h-3.5 w-3.5" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* ============ ABA: DADOS DO TICKET ============ */}
          <TabsContent
            value="dados"
            className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {/* Destaque do solicitante no topo */}
              {ticket.requester_name && (
                <div className="flex items-center gap-2 rounded-lg border bg-primary/5 border-primary/20 px-3 py-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground leading-none">Solicitante</div>
                    <div className="text-sm font-semibold truncate">
                      {ticket.requester_name}
                      {ticket.requester_phone ? ` · ${ticket.requester_phone}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit || saving} />
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="space-y-1">
              <Label>Responsável pelo atendimento</Label>
              <TeamMemberSelect
                members={memberOptions}
                value={assignedName}
                onValueChange={setAssignedName}
                valueKey="name"
                allowUnassigned
                showCurrentUserShortcut
                placeholder="Selecione um membro da equipe…"
                className="w-full"
                disabled={!canEdit || saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Departamento</Label>
                <Select
                  value={departmentId}
                  onValueChange={(v) => { setDepartmentId(v); setCategoryId(''); }}
                  disabled={!canEdit || saving}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={!canEdit || saving || deptCategories.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {deptCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status atual</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) => handleStatus(v as TicketStatus)}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                      s === 'resolved' || s === 'closed' ? null : (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t bg-muted/20 flex-shrink-0">
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  title="Excluir chamado"
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              )}
              {!isClosed && canEdit && (
                <Button variant="outline" size="sm" onClick={() => setConfirmResolveOpen(true)}>
                  Resolver
                </Button>
              )}
              {isClosed && canEdit && (
                <Button variant="outline" size="sm" onClick={() => handleStatus('open')}>
                  Reabrir
                </Button>
              )}
              <Button onClick={handleSave} disabled={!canEdit || saving} size="sm">
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </TabsContent>

          {/* ============ ABA: CONVERSAS ============ */}
          <TabsContent
            value="conversas"
            className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden data-[state=inactive]:hidden"
          >
            {/* Topo fixo: Sobre + Composer */}
            <div className="flex-shrink-0 border-b p-4 space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sobre este chamado</p>
                <p className="font-medium">{ticket.subject}</p>
                {ticket.description && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>
                )}
              </div>

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
                  placeholder={internal ? 'Nota interna (não visível ao solicitante)' : 'Escreva uma resposta…'}
                  className="min-h-[70px]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {isAgent && !internal ? (() => {
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
                                id="ticket-panel-send-whatsapp"
                                checked={sendWhatsApp && hasChannel}
                                onCheckedChange={setSendWhatsApp}
                                disabled={disabled}
                              />
                              <Label htmlFor="ticket-panel-send-whatsapp" className="text-xs cursor-pointer">
                                Enviar para WhatsApp
                              </Label>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{reason}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })() : <span />}
                  <Button onClick={handleSend} disabled={sending || !draft.trim()} size="sm">
                    <Send className="h-4 w-4 mr-1" /> {sending ? 'Enviando…' : internal ? 'Salvar nota' : 'Responder'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Corpo rolável: Histórico de Conversa */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="sticky top-0 bg-background z-10 px-4 py-2 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Histórico de Conversa
                </h3>
              </div>
              <div className="p-4">
                {interactions.length === 0 ? (
                  <p className="text-xs text-muted-foreground pt-6 text-center">Sem respostas ou notas ainda.</p>
                ) : (
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
                )}
              </div>
            </div>
          </TabsContent>

          {/* ============ ABA: HISTÓRICO ============ */}
          <TabsContent
            value="historico"
            className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" /> Eventos do chamado
              </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-6 text-center">Sem eventos registrados ainda.</p>
              ) : (
                <TicketTimeline messages={events} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

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

      {/* Exclusão de chamado: dupla confirmação (digitar + switch) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O chamado e todo o seu histórico de mensagens e eventos serão excluídos permanentemente.
              <br /><br />
              Para confirmar, digite <code className="font-mono text-foreground">EXCLUIR</code> abaixo e ative o switch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ticket-delete-confirm">Digite EXCLUIR para confirmar</Label>
              <Input
                id="ticket-delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="ticket-allow-delete" className="cursor-pointer">
                Permitir excluir
              </Label>
              <Switch
                id="ticket-allow-delete"
                checked={allowDelete}
                onCheckedChange={setAllowDelete}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTicket.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={
                deleteTicket.isPending ||
                !allowDelete ||
                deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTicket.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de resolução */}
      <AlertDialog open={confirmResolveOpen} onOpenChange={setConfirmResolveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como resolvido?</AlertDialogTitle>
            <AlertDialogDescription>
              O chamado será movido para o status "Resolvido". Você poderá reabri-lo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { setConfirmResolveOpen(false); await handleStatus('resolved'); }}
            >
              Sim, resolver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}