import { useState } from 'react';
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
import { ArrowLeft, Send, StickyNote, MessageSquare, Star, MessageCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTicket, useTicketMutations, useTicketRole, useSupportConfig, isOverdue } from './hooks/useTickets';
import {
  STATUS_LABEL, STATUS_BADGE, STATUS_ORDER, PRIORITY_LABEL, PRIORITY_BADGE,
  type TicketStatus, type TicketPriority,
} from './types';

function SlaBadge({ overdue }: { overdue: boolean }) {
  return overdue
    ? <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1"><AlertTriangle className="h-3 w-3" />SLA atrasado</Badge>
    : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1"><Clock className="h-3 w-3" />No prazo</Badge>;
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const role = useTicketRole();
  const { ticket, messages, isLoading } = useTicket(id);
  const { reply, setStatus, update, setCsat, deleteTicket } = useTicketMutations();
  const { departments, categories } = useSupportConfig();

  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [csat, setCsatScore] = useState(0);
  const [csatComment, setCsatComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        {/* Coluna esquerda: meta */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3"><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
              <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
              <SlaBadge overdue={isOverdue(ticket)} />
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
                  <Select value={ticket.department_id ?? ''} onValueChange={(v) => update.mutate({ ticketId: ticket.id, patch: { department_id: v } })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Categoria</span>
                  <Select value={ticket.category_id ?? ''} onValueChange={(v) => update.mutate({ ticketId: ticket.id, patch: { category_id: v } })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{categories.filter((c) => !c.department_id || c.department_id === ticket.department_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-muted-foreground">Solicitante</p>
              <p className="font-medium">{ticket.requester_name || '—'}</p>
              {ticket.requester_email && <p className="text-xs text-muted-foreground">{ticket.requester_email}</p>}
              {ticket.requester_phone && <p className="text-xs text-muted-foreground">{ticket.requester_phone}</p>}
            </div>

            {ticket.conversation_id && (
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => navigate('/chat')}>
                <MessageCircle className="h-4 w-4" /> Abrir conversa no WhatsApp
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

        {/* Coluna direita: descrição + thread */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3"><CardTitle className="text-base">Conversa</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            {ticket.description && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{ticket.description}</div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {visibleMessages.map((m) => {
                if (m.kind === 'event') {
                  return <p key={m.id} className="text-center text-[11px] text-muted-foreground py-1">{m.body} · {format(new Date(m.created_at), 'dd/MM HH:mm')}</p>;
                }
                const mine = m.author_role === 'agent';
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'rounded-lg px-3 py-2 max-w-[80%] text-sm',
                      m.kind === 'internal'
                        ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900'
                        : mine ? 'bg-primary/10' : 'bg-muted',
                    )}>
                      <div className="flex items-center gap-1 mb-0.5">
                        {m.kind === 'internal' && <StickyNote className="h-3 w-3 text-amber-600" />}
                        <span className="text-[11px] font-medium">{m.author_name || (mine ? 'Suporte' : 'Solicitante')}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), 'dd/MM HH:mm')}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
