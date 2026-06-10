import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  MessageCircle, User, Eye, MoreHorizontal, ChevronDown, Plus,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { useTickets, useTicketMutations, type TicketFilters } from '../hooks/useTickets';
import { TicketSlaBadge } from './TicketSlaBadge';
import { NewTicketDialog } from './NewTicketDialog';
import {
  KANBAN_STATUSES, STATUS_LABEL, PRIORITY_LABEL, PRIORITY_BADGE,
  type SupportTicket, type TicketStatus,
} from '../types';

const ITEMS_PER_PAGE = 30;

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: '#3b82f6',
  pending: '#f59e0b',
  in_progress: '#8b5cf6',
  waiting_customer: '#f97316',
  resolved: '#10b981',
  closed: '#6b7280',
};

function TicketCard({
  ticket, onView, onResolve, onClose, dragging,
}: {
  ticket: SupportTicket;
  onView?: () => void;
  onResolve?: () => void;
  onClose?: () => void;
  dragging?: boolean;
}) {
  const navigate = useNavigate();
  const color = STATUS_COLOR[ticket.status];
  return (
    <Card
      style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all hover:shadow-md group border-l-4',
        dragging && 'opacity-30 ring-2 ring-primary/50 ring-dashed bg-primary/5',
      )}
      onClick={onView}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: número + assunto + ações */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] font-mono text-muted-foreground">
                #{ticket.protocol ?? ticket.number ?? '—'}
              </span>
              <TicketSlaBadge ticket={ticket} compact />
            </div>
            <h4 className="font-medium text-sm line-clamp-2">{ticket.subject}</h4>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {ticket.conversation_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat?conversation=${ticket.conversation_id}`);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir conversa vinculada</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onView?.(); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Abrir chamado
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResolve?.(); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                  Marcar como resolvido
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Fechar chamado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Solicitante */}
        {ticket.requester_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{ticket.requester_name}</span>
          </div>
        )}

        {/* Badges: prioridade + responsável */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Badge className={cn('text-[10px] px-1.5 py-0', PRIORITY_BADGE[ticket.priority])}>
            {PRIORITY_LABEL[ticket.priority]}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 gap-1 max-w-[140px]',
              ticket.assigned_to_name
                ? 'bg-primary/5 border-primary/30 text-primary'
                : 'bg-muted text-muted-foreground border-border',
            )}
            title={ticket.assigned_to_name || 'Não atribuído'}
          >
            <User className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{ticket.assigned_to_name || 'Não atribuído'}</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableCard({
  ticket, onView, onResolve, onClose,
}: {
  ticket: SupportTicket;
  onView: () => void;
  onResolve: () => void;
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && 'opacity-40')}>
      <TicketCard ticket={ticket} onView={onView} onResolve={onResolve} onClose={onClose} />
    </div>
  );
}

function Column({
  status, tickets, onCardClick, onResolve, onClose, onAdd,
}: {
  status: TicketStatus;
  tickets: SupportTicket[];
  onCardClick: (id: string) => void;
  onResolve: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const color = STATUS_COLOR[status];

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [tickets.length]);

  const hasMore = tickets.length > visibleCount;
  const remaining = Math.min(ITEMS_PER_PAGE, tickets.length - visibleCount);
  const visible = tickets.slice(0, visibleCount);

  return (
    <div className="flex-shrink-0 min-w-[280px] max-w-[280px] flex flex-col bg-muted/30 rounded-lg h-full">
      {/* Header tintado */}
      <div
        className="p-3 rounded-t-lg flex items-center justify-between gap-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <h3 className="font-medium text-sm truncate">{STATUS_LABEL[status]}</h3>
          <Badge variant="secondary" className="text-xs">{tickets.length}</Badge>
        </div>
      </div>

      {/* Área de drop */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-col p-2 transition-colors min-h-[300px] overflow-y-auto scrollbar-none',
          isOver && 'ring-2 ring-primary bg-primary/10',
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="space-y-2">
          {tickets.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum chamado nesta etapa
            </div>
          ) : (
            <>
              {visible.map((t) => (
                <DraggableCard
                  key={t.id}
                  ticket={t}
                  onView={() => onCardClick(t.id)}
                  onResolve={() => onResolve(t.id)}
                  onClose={() => onClose(t.id)}
                />
              ))}
              {hasMore && (
                <div className="pt-2 border-t border-border/50 text-center space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVisibleCount((p) => Math.min(p + ITEMS_PER_PAGE, tickets.length))}
                    className="w-full gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Ver mais ({remaining})
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Exibindo {visibleCount} de {tickets.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex-1 min-h-[60px]" />
      </div>

      {/* Footer */}
      <div className="p-2 pt-0 rounded-b-lg">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo chamado
        </Button>
      </div>
    </div>
  );
}

export function TicketsKanban({ filters }: { filters: TicketFilters }) {
  const navigate = useNavigate();
  const { tickets, isLoading } = useTickets(filters);
  const { setStatus } = useTicketMutations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const ticketId = String(active.id);
    const newStatus = String(over.id) as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;
    if (!KANBAN_STATUSES.includes(newStatus)) return;
    setStatus.mutate({ ticketId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div
        className="flex gap-3 overflow-x-auto overflow-y-auto pb-2 scrollbar-none h-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {KANBAN_STATUSES.map((s) => <Skeleton key={s} className="h-72 min-w-[260px]" />)}
      </div>
    );
  }

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="flex gap-4 overflow-x-auto overflow-y-auto pb-2 scrollbar-none h-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {KANBAN_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tickets={tickets.filter((t) => t.status === status)}
              onCardClick={(id) => navigate(`/tickets/${id}`)}
              onResolve={(id) => setStatus.mutate({ ticketId: id, status: 'resolved' })}
              onClose={(id) => setStatus.mutate({ ticketId: id, status: 'closed' })}
              onAdd={() => setNewOpen(true)}
            />
          ))}
        </div>
        <DragOverlay>{activeTicket && <TicketCard ticket={activeTicket} dragging />}</DragOverlay>
      </DndContext>
      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => navigate(`/tickets/${id}`)}
      />
    </>
  );
}
