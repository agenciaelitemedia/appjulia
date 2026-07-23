import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EditContactDialog } from './EditContactDialog';
import { DeleteContactDialog } from './DeleteContactDialog';
import { MediaLightbox } from '@/components/chat/MediaLightbox';
import type { ContactRow } from '../hooks/useContactsList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { setPendingSelection } from '@/lib/chat/pendingSelection';
import { toast } from 'sonner';

interface Props {
  contacts: ContactRow[];
  isLoading: boolean;
  isGroup: boolean;
}

const PAGE_SIZE = 50;

export function ContactsTable({ contacts, isLoading, isGroup }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const [lightbox, setLightbox] = useState<ContactRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE));
  const paginated = useMemo(
    () => contacts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [contacts, page],
  );

  const handleOpenChat = async (contactId: string) => {
    const clientId = user?.client_id ? String(user.client_id) : '';
    const userName = user?.name || '';
    const userId = user?.id ? Number(user.id) : null;
    if (!clientId || !userName) {
      navigate('/chat');
      return;
    }
    try {
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('id, queue_id, status, assigned_to')
        .eq('client_id', clientId)
        .eq('contact_id', contactId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let conversationId: string | null = null;
      let queueId: string | null = null;

      if (conv) {
        conversationId = conv.id as string;
        queueId = (conv.queue_id as string | null) ?? null;
        const status = String(conv.status || '');
        const currentAssignee = (conv.assigned_to || '').toString().trim();
        const needsReopen = status === 'resolved' || status === 'closed';
        const needsAssign = needsReopen || currentAssignee === '' || currentAssignee !== userName;

        if (needsReopen || needsAssign) {
          const updates: Record<string, unknown> = {
            assigned_to: userName,
            assigned_user_id: userId,
            updated_at: new Date().toISOString(),
          };
          if (needsReopen) {
            updates.status = 'open';
            updates.resolved_at = null;
            updates.closed_at = null;
          } else if (status === 'pending') {
            updates.status = 'open';
          }

          const { error: updErr } = await supabase
            .from('chat_conversations')
            .update(updates)
            .eq('id', conversationId);
          if (updErr) throw updErr;

          const historyRows: Array<Record<string, unknown>> = [];
          if (needsReopen) {
            historyRows.push({
              conversation_id: conversationId,
              action: 'reopened',
              actor_name: userName,
              actor_user_id: userId,
              notes: 'Reaberta ao abrir chat pela lista de contatos',
            });
          }
          historyRows.push({
            conversation_id: conversationId,
            action: 'assigned',
            actor_name: userName,
            actor_user_id: userId,
            to_value: userName,
            to_user_id: userId,
          });
          await supabase.from('chat_conversation_history').insert(historyRows);
        }
      }

      setPendingSelection({
        contactId,
        queueId,
        conversationId,
        tab: 'open',
      });
      navigate('/chat');
    } catch (err) {
      console.error('[ContactsTable] handleOpenChat error:', err);
      toast.error('Não foi possível abrir o chat. Tente novamente.');
    }
  };

  const truncate = (s: string, n = 30) =>
    s.length > n ? s.slice(0, n).trimEnd() + '…' : s;

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return '—';
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Fila</TableHead>
              <TableHead>Última mensagem</TableHead>
              <TableHead className="text-right w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum {isGroup ? 'grupo' : 'contato'} encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => c.avatar && setLightbox(c)}
                      className={c.avatar ? 'cursor-zoom-in' : 'cursor-default'}
                      aria-label="Ver foto"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={c.avatar ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(c.name || c.phone).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{truncate(c.name || '—')}</TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell>
                    {c.queue_name ? (
                      <Badge variant="secondary" className="text-xs">{c.queue_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(c.last_message_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10" onClick={() => handleOpenChat(c.id)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Abrir Chat</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {contacts.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} • {contacts.length} {isGroup ? 'grupos' : 'contatos'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <EditContactDialog contact={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <DeleteContactDialog contact={deleting} open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} />
      <MediaLightbox
        open={!!lightbox}
        onOpenChange={(o) => !o && setLightbox(null)}
        url={lightbox?.avatar ?? null}
        caption={lightbox?.name ?? null}
        fileName={lightbox ? `${(lightbox.name || lightbox.phone).replace(/[^a-zA-Z0-9-_]+/g, '_')}.jpg` : null}
        kind="image"
      />
    </TooltipProvider>
  );
}