import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/components/chat/SmartAvatarImage';
import { Badge } from '@/components/ui/badge';
import { Users, MessageCircle, Globe, Instagram, Kanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { differenceInMinutes, differenceInHours } from 'date-fns';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation, ChatTag } from '@/types/conversation';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import { SlaBadge } from '@/components/chat/SlaBadge';
import { JuliaStatusBadge } from '@/components/chat/JuliaStatusBadge';
import { PriorityBadge } from '@/components/chat/PriorityBadge';
import { getMessagePreview } from '@/lib/chat/messagePreview';

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
  hasCrmCard?: boolean;
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
  hasCrmCard,
}: ChatContactItemProps) {
  const { configs } = useChatSlaConfigs();

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
        last_customer_message_at: conversation.last_customer_message_at ?? null,
        last_message_from_me: conversation.last_message_from_me ?? null,
      },
      configs
    );
  }, [conversation, configs]);

  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const formattedTime = contact.last_message_at
    ? formatRelativeTime(contact.last_message_at)
    : null;

  const visibleTags = (convTags || []).slice(0, 2);

  return (
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
        'w-full max-w-full flex items-start gap-3 px-3 py-3 text-left transition-all border-l-[4px] min-w-0 overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

        {/* Row 2.5: Agent IA (esquerda) + Etapa CRM (direita) — só quando há vínculo com agente IA */}
        {(agentCodAgent || stageName) && (
          <div className="flex items-center justify-between gap-1 min-w-0 w-full">
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {agentCodAgent && (
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  #{agentCodAgent}{agentAlias ? ` · ${agentAlias}` : ''}
                </span>
              )}
            </div>
            {stageName && (
              <span
                className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                style={{ backgroundColor: stageColor || '#64748b' }}
              >
                {stageName}
              </span>
            )}
          </div>
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
                !slaEvaluation && !hasCrmCard && 'rounded-r'
              )}
            />
            {slaEvaluation && (
              <SlaBadge
                evaluation={slaEvaluation}
                compact
                className={cn('w-[64px]', !hasCrmCard && 'rounded-r')}
              />
            )}
            {hasCrmCard && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center justify-center gap-0.5 h-5 w-[44px] px-1 text-[9px] font-bold leading-none rounded-r bg-blue-50 text-blue-700 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Kanban className="h-2.5 w-2.5 flex-shrink-0" />
                      CRM
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Este contato possui card no CRM
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {conversation && (
            <div className="ml-auto flex-shrink-0">
              <PriorityBadge
                conversationId={conversation.id}
                currentPriority={conversation.priority}
                compact
              />
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
});
