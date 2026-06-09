import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';
import { User } from 'lucide-react';
import { useTickets, useTicketMutations, type TicketFilters } from '../hooks/useTickets';
import { TicketSlaBadge } from './TicketSlaBadge';
import {
  KANBAN_STATUSES, STATUS_LABEL, STATUS_BADGE, PRIORITY_LABEL, PRIORITY_BADGE,
  type SupportTicket, type TicketStatus,
} from '../types';

function TicketCard({ ticket, onClick, dragging }: { ticket: SupportTicket; onClick?: () => void; dragging?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing',
        dragging && 'shadow-lg ring-2 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono text-muted-foreground">#{ticket.number ?? '—'}</span>
        {ticket.conversation_id && <MessageCircle className="h-3 w-3 text-emerald-500" />}
        <span className="ml-auto"><TicketSlaBadge ticket={ticket} compact /></span>
      </div>
      <p className="text-sm font-medium line-clamp-2">{ticket.subject}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
        <span className="text-[11px] text-muted-foreground truncate">{ticket.requester_name || '—'}</span>
      </div>
      {ticket.assigned_to_name && (
        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
          <User className="h-3 w-3" /> {ticket.assigned_to_name}
        </Badge>
      )}
    </div>
  );
}

function DraggableCard({ ticket, onClick }: { ticket: SupportTicket; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && 'opacity-40')}>
      <TicketCard ticket={ticket} onClick={onClick} />
    </div>
  );
}

function Column({ status, tickets, onCardClick }: { status: TicketStatus; tickets: SupportTicket[]; onCardClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px] flex-shrink-0 h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <Badge className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
        <span className="text-xs text-muted-foreground">{tickets.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 rounded-lg p-2 min-h-[120px] overflow-y-auto scrollbar-none transition-colors',
          isOver ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-muted/30',
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tickets.map((t) => <DraggableCard key={t.id} ticket={t} onClick={() => onCardClick(t.id)} />)}
        {tickets.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-4">Vazio</p>}
      </div>
    </div>
  );
}

export function TicketsKanban({ filters }: { filters: TicketFilters }) {
  const navigate = useNavigate();
  const { tickets, isLoading } = useTickets(filters);
  const { setStatus } = useTicketMutations();
  const [activeId, setActiveId] = useState<string | null>(null);

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
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="flex gap-3 overflow-x-auto overflow-y-auto pb-2 scrollbar-none h-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {KANBAN_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={tickets.filter((t) => t.status === status)}
            onCardClick={(id) => navigate(`/tickets/${id}`)}
          />
        ))}
      </div>
      <DragOverlay>{activeTicket && <TicketCard ticket={activeTicket} dragging />}</DragOverlay>
    </DndContext>
  );
}
