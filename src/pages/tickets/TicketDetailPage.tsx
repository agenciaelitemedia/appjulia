import { useState } from 'react';
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
  ArrowLeft, Send, StickyNote, MessageSquare, Star, MessageCircle, Trash2,
  CircleDot, ArrowRightLeft, Flag, UserCheck, Reply, Star as StarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTicket, useTicketMutations, useTicketRole, useSupportConfig } from './hooks/useTickets';
import { TicketSlaBadge } from './components/TicketSlaBadge';
import { TeamMemberSelect, type TeamMemberOption } from '@/components/TeamMemberSelect';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import {
  STATUS_LABEL, STATUS_BADGE, STATUS_ORDER, PRIORITY_LABEL, PRIORITY_BADGE,
  type TicketStatus, type TicketPriority,
} from './types';
import type { TicketMessage } from './types';

function eventIcon(m: TicketMessage) {
  if (m.kind === 'public') return Reply;
  if (m.kind === 'internal') return StickyNote;
  switch (m.event_type) {
    case 'created': return CircleDot;
    case 'status_change': return ArrowRightLeft;
    case 'assigned': return UserCheck;
    case 'csat': return StarIcon;
    default: return Flag;
  }
}

function TicketTimeline({ messages }: { messages: TicketMessage[] }) {
  const items = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">Sem interações ainda.</p>;
  }
  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
      {items.map((m) => {
        const Icon = eventIcon(m);
        const ts = format(new Date(m.created_at), 'dd/MM/yyyy HH:mm');
        const author = m.author_name || (m.author_role === 'agent' ? 'Suporte' : 'Solicitante');

        // Bullet/icon comum
        const bullet = (extra?: string) => (
          <span
            className={cn(
              'absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border bg-background',
              extra,
            )}
          >
            <Icon className="h-3 w-3 text-muted-foreground" />
          </span>
        );

        if (m.kind === 'event') {
          return (
            <li key={m.id} className="relative pl-6">
              {bullet('bg-muted/40')}
              <div className="text-xs text-muted-foreground leading-snug">
                <span className="text-foreground">{m.body || m.event_type || 'Evento'}</span>
                <span className="mx-1">·</span>
                <span>{ts}</span>
                {m.author_name ? <span> · {m.author_name}</span> : null}
              </div>
            </li>
          );
        }

        const isInternal = m.kind === 'internal';
        return (
          <li key={m.id} className="relative pl-6">
            {bullet(isInternal ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40' : 'bg-background')}
            <div
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                isInternal
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/50'
                  : 'bg-card',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium">
                  {isInternal ? `Nota interna · ${author}` : `Resposta de ${author}`}
                </span>
                <span className="text-[11px] text-muted-foreground">{ts}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const role = useTicketRole();
  const { ticket, messages, isLoading } = useTicket(id);
  const { reply, setStatus, update, setCsat, deleteTicket, assign } = useTicketMutations();
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
  const [csat, setCsatScore] = useState(0);
  const [csatComment, setCsatComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

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

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!ticket) return <div className="text-center text-muted-foreground py-12">Chamado não encontrado.</div>;

  // Solicitante não vê notas internas
  const visibleMessages = messages.filter((m) => isAgent || m.kind !== 'internal');

  const handleSend = async () => {
    if (!draft.trim() || !id) return;
    setSending(true);
    try {
      await reply.mutateAsync({ ticketId: id, body: draft.trim(), internal: internal && isAgent });
      setDraft('');
      setInternal(false);
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
          <h1 className="text-lg font-bold truncate">#{ticket.number} · {ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">Aberto em {ticket.opened_at ? format(new Date(ticket.opened_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
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
        {/* Coluna esquerda: detalhes */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-3 text-sm">
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
          </CardContent>
        </Card>

        {/* Coluna direita: descrição + timeline + composer */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3"><CardTitle className="text-base">Interações</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            {ticket.description && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Descrição original</p>
                {ticket.description}
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <TicketTimeline messages={visibleMessages} />
            </div>

            {/* Composer */}
            <div className="border-t pt-3 space-y-2">
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
              <div className="flex justify-end">
                <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4 mr-1" /> {sending ? 'Enviando…' : internal ? 'Salvar nota' : 'Responder'}
                </Button>
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
