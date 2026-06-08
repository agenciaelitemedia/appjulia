import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertTriangle, MessageCircle, Inbox, User } from 'lucide-react';
import { format } from 'date-fns';
import { useTickets, isOverdue, type TicketFilters } from '../hooks/useTickets';
import {
  STATUS_LABEL, STATUS_BADGE, STATUS_ORDER, PRIORITY_LABEL, PRIORITY_BADGE,
  type SupportTicket, type TicketStatus, type TicketPriority,
} from '../types';

interface TicketsListTabProps {
  filters: TicketFilters;
  onFiltersChange: (f: TicketFilters) => void;
  showRequester?: boolean; // agent/manager veem o solicitante
  emptyHint?: string;
}

function TicketRow({ ticket, showRequester, onClick }: { ticket: SupportTicket; showRequester?: boolean; onClick: () => void }) {
  const overdue = isOverdue(ticket);
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{ticket.number ?? '—'}</span>
            <span className="font-medium truncate">{ticket.subject}</span>
            {ticket.conversation_id && <MessageCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
          </div>
          {showRequester && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {ticket.requester_name || ticket.requester_email || '—'}
              {ticket.assigned_to_name ? ` · resp. ${ticket.assigned_to_name}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Badge className={PRIORITY_BADGE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</Badge>
            <Badge className={STATUS_BADGE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            {ticket.assigned_to_name && (
              <Badge variant="outline" className="gap-1 font-normal">
                <User className="h-3 w-3" /> {ticket.assigned_to_name}
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            {overdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
            {format(new Date(ticket.created_at), 'dd/MM HH:mm')}
          </span>
        </div>
      </div>
    </button>
  );
}

export function TicketsListTab({ filters, onFiltersChange, showRequester, emptyHint }: TicketsListTabProps) {
  const navigate = useNavigate();
  const { tickets, isLoading } = useTickets(filters);

  const set = (patch: Partial<TicketFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Buscar por nº, assunto ou solicitante"
            className="pl-8"
          />
        </div>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v as TicketStatus | 'all' })}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority ?? 'all'} onValueChange={(v) => set({ priority: v as TicketPriority | 'all' })}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridade</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : tickets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">{emptyHint ?? 'Nenhum chamado encontrado.'}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} showRequester={showRequester} onClick={() => navigate(`/tickets/${t.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
