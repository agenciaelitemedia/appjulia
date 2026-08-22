import { memo, useMemo } from 'react';
import { CheckCheck, Clock, Megaphone, Bot, User, Ticket, Kanban, Users } from 'lucide-react';
import {
  Avatar, AvatarFallback, AvatarImage, Badge, cn,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  getMessagePreview, evaluateSla, SlaBadge,
} from '../extend/ui';
import type { MvpChatRowData } from '../api/types';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Formatação temporal estilo WhatsApp. */
function formatWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now.getTime() - 864e5);
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  if (now.getTime() - d.getTime() < 7 * 864e5) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  open: 'bg-primary/15 text-primary',
  resolved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando', open: 'Atendimento', resolved: 'Resolvida', closed: 'Fechada',
};

interface Props {
  row: MvpChatRowData;
  selected?: boolean;
  onSelect?: (row: MvpChatRowData) => void;
}

export const MvpChatRow = memo(function MvpChatRow({ row, selected, onSelect }: Props) {
  const preview = useMemo(
    () => getMessagePreview({ text: row.last_message_text, type: 'text' } as any) || 'Sem mensagens',
    [row.last_message_text],
  );

  const sla = useMemo(
    () => evaluateSla(
      {
        status: row.status,
        priority: row.priority || 'normal',
        opened_at: row.opened_at,
        first_response_at: row.first_response_at,
        resolved_at: row.resolved_at,
        closed_at: row.closed_at,
        last_customer_message_at: row.last_customer_message_at,
        last_message_from_me: row.last_message_from_me,
      },
      [],
    ),
    [row.status, row.priority, row.opened_at, row.first_response_at, row.resolved_at, row.closed_at, row.last_customer_message_at, row.last_message_from_me],
  );

  const campaignTitle = (row.campaign?.campaign_data as any)?.campaign_name
    || (row.campaign?.campaign_data as any)?.title
    || 'Meta Ads';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row)}
      className={cn(
        'w-full rounded-xl border-[2px] border-foreground/20 bg-card/70 p-3 text-left backdrop-blur-sm transition-colors',
        'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary/60 bg-primary/10',
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-11 w-11 shrink-0">
          {row.avatar ? <AvatarImage src={row.avatar} alt={row.contact_name ?? 'Contato'} /> : null}
          <AvatarFallback className="text-xs font-semibold">
            {row.is_group ? <Users className="h-4 w-4" /> : initials(row.lead_full_name || row.contact_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">
              {row.lead_full_name || row.contact_name || row.phone || 'Sem nome'}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {formatWhen(row.last_message_at || row.conversation_updated_at)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">{preview}</p>
            {row.unread_count > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {row.unread_count > 99 ? '99+' : row.unread_count}
              </span>
            )}
          </div>

          {/* Badges — todos já vêm resolvidos do servidor (sem pop-in) */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className={cn('h-5 px-1.5 text-[10px] font-medium', STATUS_STYLE[row.status])}>
              {STATUS_LABEL[row.status] ?? row.status}
            </Badge>

            {row.queue_name && (
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                <Clock className="h-3 w-3" /> {row.queue_name}
              </Badge>
            )}

            {row.assigned_to ? (
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                <User className="h-3 w-3" /> {row.assigned_to}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">Sem responsável</Badge>
            )}

            {row.session_is_active !== null && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className={cn('h-5 gap-1 px-1.5 text-[10px]',
                        row.session_is_active
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground')}
                    >
                      <Bot className="h-3 w-3" /> {row.session_is_active ? 'Júlia ativa' : 'Humano'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Modo de atendimento (sessão da Júlia)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {row.julia_stage_name && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px]"
                style={row.julia_stage_color ? { borderColor: row.julia_stage_color, color: row.julia_stage_color } : undefined}
              >
                {row.julia_stage_name}
              </Badge>
            )}

            {row.crm_pipeline_name && (
              <Badge
                variant="outline"
                className="h-5 gap-1 px-1.5 text-[10px]"
                style={row.crm_pipeline_color ? { borderColor: row.crm_pipeline_color, color: row.crm_pipeline_color } : undefined}
              >
                <Kanban className="h-3 w-3" />
                {row.crm_board_name ? `${row.crm_board_name} · ${row.crm_pipeline_name}` : row.crm_pipeline_name}
              </Badge>
            )}

            {row.active_ticket_id && (
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                <Ticket className="h-3 w-3" />
                #{row.active_ticket_number ?? row.active_ticket_protocol ?? '—'}
              </Badge>
            )}

            {row.campaign && (
              <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Megaphone className="h-3 w-3" /> {String(campaignTitle).slice(0, 24)}
              </Badge>
            )}

            {row.tags?.map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className="h-5 px-1.5 text-[10px]"
                style={{ borderColor: t.color, color: t.color }}
              >
                {t.name}
              </Badge>
            ))}

            {row.status !== 'closed' && row.status !== 'resolved' && <SlaBadge evaluation={sla} compact />}

            {row.last_message_from_me && (
              <CheckCheck className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
});
