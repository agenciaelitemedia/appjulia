import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/components/chat/SmartAvatarImage';
import { Badge } from '@/components/ui/badge';
import { Users, MessageCircle, Globe, Instagram, Kanban, Bot, Ticket, LifeBuoy, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInMinutes, differenceInHours } from 'date-fns';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation, ChatTag } from '@/types/conversation';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import type { LastMessageMeta } from '@/hooks/useConversationsLastMessageMeta';
import { SlaBadge } from '@/components/chat/SlaBadge';
import { JuliaStatusBadge } from '@/components/chat/JuliaStatusBadge';
import { PriorityBadge } from '@/components/chat/PriorityBadge';
import { ConversationQuickActions } from '@/components/chat/ConversationQuickActions';
import { getMessagePreview } from '@/lib/chat/messagePreview';
import type { CrmBuilderLink } from '@/hooks/useCRMBuilderLinkedConversations';
import type { TicketConversationLink } from '@/hooks/useTicketLinkedConversations';
import { STATUS_LABEL as TICKET_STATUS_LABEL, STATUS_BADGE as TICKET_STATUS_BADGE, PRIORITY_LABEL as TICKET_PRIORITY_LABEL } from '@/pages/tickets/types';

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface ChatContactItemProps {
  contact: ChatContact;
  isSelected: boolean;
  onClick: () => void;
  conversation?: ChatConversation;
  queueName?: string;
  assignedAgentName?: string;
  index?: number;
  convTags?: ChatTag[];
  agentCodAgent?: string | null;
  agentAlias?: string | null;
  stageName?: string | null;
  stageColor?: string | null;
  /** Mapa de etapas ainda carregando — evita flash de "Sem etapa". */
  stageLoading?: boolean;
  hasCrmCard?: boolean;
  /** Vínculo com card do CRM Builder (Quadro · Etapa). */
  crmBuilderLink?: CrmBuilderLink;
  /** Vínculo com ticket de suporte aberto (TICKET #N · status). */
  ticketLink?: TicketConversationLink;
  /** Metadados derivados de chat_messages para avaliar NRT corretamente. */
  lastMessageMeta?: LastMessageMeta;
  /** Acionado pelo menu de contexto para abrir/visualizar ticket de suporte. */
  onOpenTicket?: (mode: 'create' | 'detail', ticketId?: string) => void;
}

function ChannelOverlay({ channel }: { channel?: string }) {
  const iconClass = 'h-3 w-3 text-white';
  let bg = 'bg-emerald-500';
  let icon = <MessageCircle className={iconClass} />;

  switch (channel) {
    case 'whatsapp_waba':
      bg = 'bg-emerald-600';
      break;
    case 'webchat':
      bg = 'bg-blue-500';
      icon = <Globe className={iconClass} />;
      break;
    case 'instagram':
      bg = 'bg-pink-500';
      icon = <Instagram className={iconClass} />;
      break;
  }

  return (
    <div className={cn('absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background', bg)}>
      {icon}
    </div>
  );
}

/** Helena-style relative time */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const mins = differenceInMinutes(new Date(), date);
  if (mins < 1) return 'há poucos segundos';
  if (mins < 60) return `há ${mins} minutos`;
  const hrs = differenceInHours(new Date(), date);
  if (hrs < 24) return `há ${hrs} hora${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

/** Safe single-line preview for the contact list. */
function MessagePreview({ text }: { text?: string }) {
  const preview = getMessagePreview({ text: text ?? '' });
  if (!preview) return null;
  return <span className="block truncate whitespace-nowrap">{preview}</span>;
}

/** Single pill */
function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center h-5 px-1.5 text-[9px] font-bold leading-none overflow-hidden whitespace-nowrap text-center',
      className
    )}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export const ChatContactItem = React.memo(function ChatContactItem({
  contact,
  isSelected,
  onClick,
  conversation,
  queueName,
  assignedAgentName,
  index = 0,
  convTags,
  agentCodAgent,
  agentAlias,
  stageName,
  stageColor,
  stageLoading,
  hasCrmCard,
  crmBuilderLink,
  ticketLink,
  lastMessageMeta,
  onOpenTicket,
}: ChatContactItemProps) {
  const { configs } = useChatSlaConfigs();
  const { hasPermission } = useAuth();
  const canViewTickets = hasPermission('support_tickets', 'view');
  const canCreateTickets = hasPermission('support_tickets', 'create');

  const slaEvaluation = React.useMemo(() => {
    if (!conversation) return null;
    if (conversation.status === 'closed' || conversation.status === 'resolved') return null;
    return evaluateSla(
      {
        status: conversation.status,
        priority: conversation.priority ?? 'normal',
        opened_at: conversation.opened_at ?? conversation.created_at ?? new Date().toISOString(),
        first_response_at: conversation.first_response_at ?? null,
        resolved_at: conversation.resolved_at ?? null,
        closed_at: conversation.closed_at ?? null,
        last_customer_message_at: lastMessageMeta?.last_customer_message_at ?? conversation.last_customer_message_at ?? null,
        last_message_from_me: lastMessageMeta?.last_message_from_me ?? conversation.last_message_from_me ?? null,
      },
      configs
    );
  }, [conversation, configs, lastMessageMeta]);

  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const formattedTime = contact.last_message_at
    ? formatRelativeTime(contact.last_message_at)
    : null;

  const visibleTags = convTags || [];

  const itemContent = (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group w-full max-w-full flex items-start gap-3 px-3 py-3 text-left transition-all border-l-[4px] border-b border-border/50 min-w-0 overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'bg-primary/15 border-l-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)] ring-1 ring-primary/20'
          : cn(
              'border-l-transparent hover:bg-accent/20',
              index % 2 === 0 ? 'bg-background' : 'bg-muted/30'
            )
      )}
    >
      {/* Avatar with channel overlay */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar className="h-12 w-12">
          <SmartAvatarImage src={contact.avatar} alt={contact.name} contactId={contact.id} />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
            {contact.is_group ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        <ChannelOverlay channel={conversation?.channel} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden space-y-1">
        {/* Row 1: Name (left) + time (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            <JuliaStatusBadge
              whatsappNumber={contact.phone}
              codAgent={conversation?.cod_agent || contact.cod_agent}
              queueId={conversation?.queue_id || null}
              assignedTo={conversation?.assigned_to || null}
            />
            <span className={cn(
              'block truncate font-semibold text-sm',
              contact.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'
            )}>
              {contact.name.length > 30 ? contact.name.slice(0, 30).trimEnd() + '…' : contact.name}
            </span>
          </div>
          {formattedTime && (
            <span className={cn(
              'text-[11px] whitespace-nowrap flex-shrink-0',
              contact.unread_count > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'
            )}>
              {formattedTime}
            </span>
          )}
        </div>

        {/* Row 2: Last message preview (left) + unread badge (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0 w-full text-xs">
          <div
            className={cn(
              'flex-1 min-w-0 overflow-hidden text-[10px]',
              contact.unread_count > 0 ? 'text-foreground/80' : 'text-muted-foreground'
            )}
          >
            <span className="block truncate whitespace-nowrap">
              <MessagePreview text={contact.last_message_text || undefined} />
            </span>
          </div>
          {contact.unread_count > 0 ? (
            <span className="flex-shrink-0 bg-emerald-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-sm">
              {contact.unread_count > 99 ? '99+' : contact.unread_count}
            </span>
          ) : (
            <span className="flex-shrink-0 w-5" aria-hidden />
          )}
        </div>

        {/* Linha Julia: badge JULIA + cod_agent · alias + badge etapa CRM Julia (lazy) */}
        {(agentCodAgent || stageName) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between gap-1.5 min-w-0 w-full pt-1 mt-0.5 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-sm border border-emerald-100/70 dark:border-emerald-900/40 px-0 py-[2px] my-0">
                  <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="inline-flex items-center justify-center gap-0.5 h-5 px-1.5 text-[9px] font-bold leading-none rounded bg-emerald-100 text-emerald-700 whitespace-nowrap flex-shrink-0">
                      <Bot className="h-2.5 w-2.5 flex-shrink-0" />
                      JULIA
                    </span>
                    {agentCodAgent && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate min-w-0">
                        #{agentCodAgent}{agentAlias ? ` · ${agentAlias}` : ''}
                      </span>
                    )}
                  </div>
                  {agentCodAgent && (
                    <span
                      className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap max-w-[120px] truncate"
                      style={{
                        backgroundColor: stageName
                          ? (stageColor || '#64748b')
                          : stageLoading ? '#cbd5e1' : '#94a3b8',
                      }}
                      title={stageName || (stageLoading ? 'Carregando etapa…' : 'Sem etapa')}
                    >
                      {stageName || (stageLoading ? '…' : 'Sem etapa')}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold mb-1">Agente Julia</div>
                {agentCodAgent && <div>Código: #{agentCodAgent}</div>}
                {agentAlias && <div>Alias: {agentAlias}</div>}
                {stageName && <div>Etapa CRM Julia: {stageName}</div>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Linha CRM Builder: badge CRM + Quadro · Etapa (lazy) */}
        {crmBuilderLink && (crmBuilderLink.boardName || crmBuilderLink.pipelineName) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between min-w-0 w-full pt-1 mt-0.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-sm border border-blue-100/70 dark:border-blue-900/40 px-0 gap-0 py-[2px] my-0">
                  <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="inline-flex items-center justify-center gap-0.5 h-5 px-1.5 text-[9px] font-bold leading-none rounded bg-blue-100 text-blue-700 whitespace-nowrap flex-shrink-0">
                      <Kanban className="h-2.5 w-2.5 flex-shrink-0" />
                      CRM
                    </span>
                    {crmBuilderLink.boardName && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate min-w-0">
                        {crmBuilderLink.boardName}
                      </span>
                    )}
                  </div>
                  {crmBuilderLink.pipelineName && (
                    <span
                      className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                      style={{ backgroundColor: crmBuilderLink.pipelineColor || '#2563eb' }}
                    >
                      {crmBuilderLink.pipelineName}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold mb-1">Vinculado ao CRM Builder</div>
                {crmBuilderLink.boardName && <div>Quadro: {crmBuilderLink.boardName}</div>}
                {crmBuilderLink.pipelineName && <div>Etapa: {crmBuilderLink.pipelineName}</div>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Linha Ticket de Suporte: badge TICKET #N + status (lazy) */}
        {ticketLink && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  role="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/tickets/${ticketLink.ticketId}`, '_blank', 'noopener');
                  }}
                  className="flex items-center justify-between min-w-0 w-full pt-1 mt-0.5 bg-orange-50/40 dark:bg-orange-950/20 rounded-sm border border-orange-100/70 dark:border-orange-900/40 px-0 gap-0 py-[2px] my-0 cursor-pointer"
                >
                  <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="inline-flex items-center justify-center gap-0.5 h-5 px-1.5 text-[9px] font-bold leading-none rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 whitespace-nowrap flex-shrink-0">
                      <Ticket className="h-2.5 w-2.5 flex-shrink-0" />
                      TICKET
                    </span>
                    {ticketLink.number != null && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate min-w-0">
                        #{ticketLink.number}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap',
                      TICKET_STATUS_BADGE[ticketLink.status],
                    )}
                  >
                    {TICKET_STATUS_LABEL[ticketLink.status]}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-semibold mb-1">Ticket de suporte aberto</div>
                {ticketLink.number != null && <div>Número: #{ticketLink.number}</div>}
                {ticketLink.subject && <div>Assunto: {ticketLink.subject}</div>}
                <div>Status: {TICKET_STATUS_LABEL[ticketLink.status]}</div>
                <div>Prioridade: {TICKET_PRIORITY_LABEL[ticketLink.priority]}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Row 3: Tags — fila → SLA → atribuído → extras → prioridade (direita) */}
        <div className="flex items-center gap-1 flex-nowrap min-w-0 overflow-hidden w-full">
          <div className="flex items-stretch gap-0 flex-shrink-0 mr-2">
            {queueName && (
              <Pill
                label={toTitleCase(queueName)}
                className="bg-blue-600 text-white rounded-l w-[110px]"
              />
            )}
            <Pill
              label={assignedAgentName ? toTitleCase(assignedAgentName) : 'Não Atribuído'}
              className={cn(
                'w-[110px]',
                'bg-slate-100 text-slate-900',
                assignedAgentName ? 'font-bold' : '!font-normal',
                !slaEvaluation && 'rounded-r'
              )}
            />
            {slaEvaluation && (
              <SlaBadge
                evaluation={slaEvaluation}
                compact
                className={cn('w-[64px]', 'rounded-r')}
              />
            )}
          </div>
          {conversation && (
            <div className="ml-auto flex-shrink-0 flex items-center gap-1">
              <PriorityBadge
                conversationId={conversation.id}
                currentPriority={conversation.priority}
                compact
              />
              <ConversationQuickActions conversation={conversation} />
            </div>
          )}
        </div>

        {/* Row 4: Tags (abaixo da linha da fila) */}
        {visibleTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap min-w-0 overflow-hidden w-full">
            {visibleTags.map(tag => (
              <span key={tag.id} className="flex-shrink-0 max-w-[120px] truncate">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold text-white truncate max-w-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                >
                  {tag.name.toUpperCase()}
                </span>
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}, (prev, next) => {
  // Custom shallow comparison: avoids re-renders when parent rebuilds
  // empty arrays / equal objects with new references on every scroll tick.
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.onClick !== next.onClick) return false;
  if (prev.queueName !== next.queueName) return false;
  if (prev.assignedAgentName !== next.assignedAgentName) return false;
  if (prev.agentCodAgent !== next.agentCodAgent) return false;
  if (prev.agentAlias !== next.agentAlias) return false;
  if (prev.stageName !== next.stageName) return false;
  if (prev.stageColor !== next.stageColor) return false;
  if (prev.hasCrmCard !== next.hasCrmCard) return false;
  if (prev.crmBuilderLink !== next.crmBuilderLink) return false;
  if (prev.ticketLink?.ticketId !== next.ticketLink?.ticketId) return false;
  if (prev.ticketLink?.status !== next.ticketLink?.status) return false;
  if (prev.ticketLink?.number !== next.ticketLink?.number) return false;
  if (prev.index !== next.index) return false;
  if (prev.contact?.id !== next.contact?.id) return false;
  if (prev.contact?.name !== next.contact?.name) return false;
  if (prev.contact?.avatar !== next.contact?.avatar) return false;
  if (prev.contact?.unread_count !== next.contact?.unread_count) return false;
  if (prev.contact?.last_message_at !== next.contact?.last_message_at) return false;
  if (prev.contact?.last_message_text !== next.contact?.last_message_text) return false;
  if (prev.conversation?.id !== next.conversation?.id) return false;
  if (prev.conversation?.status !== next.conversation?.status) return false;
  if (prev.conversation?.updated_at !== next.conversation?.updated_at) return false;
  if (prev.conversation?.priority !== next.conversation?.priority) return false;
  if (prev.conversation?.assigned_to !== next.conversation?.assigned_to) return false;
  // convTags: compare length + ids
  const a = prev.convTags || []; const b = next.convTags || [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id || a[i]?.name !== b[i]?.name) return false;
  }
  // lastMessageMeta
  const lm1 = prev.lastMessageMeta; const lm2 = next.lastMessageMeta;
  if ((lm1 && !lm2) || (!lm1 && lm2)) return false;
  if (lm1 && lm2) {
    if (
      lm1.last_message_at !== lm2.last_message_at ||
      lm1.last_message_from_me !== lm2.last_message_from_me ||
      lm1.last_customer_message_at !== lm2.last_customer_message_at
    ) return false;
  }
  return true;
});
