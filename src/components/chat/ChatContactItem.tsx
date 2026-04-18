import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, MessageCircle, Globe, Instagram, Camera, Video, Mic, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInMinutes, differenceInHours } from 'date-fns';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation } from '@/types/conversation';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';
import { SlaBadge } from '@/components/chat/SlaBadge';

interface ChatContactItemProps {
  contact: ChatContact;
  isSelected: boolean;
  onClick: () => void;
  conversation?: ChatConversation;
  queueName?: string;
  assignedAgentName?: string;
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

/** Message preview with media type icon */
function MessagePreview({ text, type }: { text?: string; type?: string }) {
  if (!text && !type) return null;

  const mediaType = type || (text?.match(/^\[(\w+)\]$/)?.[1]);

  const mediaIcons: Record<string, React.ReactNode> = {
    image: <><Camera className="h-3 w-3 text-muted-foreground inline mr-1" /> Foto</>,
    video: <><Video className="h-3 w-3 text-muted-foreground inline mr-1" /> Vídeo</>,
    audio: <><Mic className="h-3 w-3 text-muted-foreground inline mr-1" /> Áudio</>,
    ptt: <><Mic className="h-3 w-3 text-muted-foreground inline mr-1" /> Áudio</>,
    document: <><FileText className="h-3 w-3 text-muted-foreground inline mr-1" /> Documento</>,
    sticker: <>🏷️ Sticker</>,
  };

  if (mediaType && mediaIcons[mediaType]) {
    return <span className="inline-flex items-center text-muted-foreground truncate whitespace-nowrap">{mediaIcons[mediaType]}</span>;
  }

  const singleLine = (text || '').replace(/\s+/g, ' ').trim();
  return <span className="block truncate whitespace-nowrap">{singleLine}</span>;
}

/** Single pill */
function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap', className)}>
      {label}
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

  const extraBadges: { label: string; className: string }[] = [];
  if (conversation?.priority === 'high' || conversation?.priority === 'urgent') {
    extraBadges.push({ label: 'PRIORIDADE', className: 'bg-red-500 text-white' });
  }
  if (conversation?.tags && conversation.tags.length > 0) {
    conversation.tags.slice(0, 2).forEach(tag => {
      extraBadges.push({ label: tag.toUpperCase(), className: 'bg-emerald-600 text-white' });
    });
  }

  return (
    <button
      onClick={onClick}
      style={{ maxWidth: '100%' }}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-l-[3px] min-w-0 overflow-hidden',
        isSelected
          ? 'bg-accent/40 border-l-primary'
          : 'border-l-transparent hover:bg-accent/20'
      )}
    >
      {/* Avatar with channel overlay */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar className="h-12 w-12">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
            {contact.is_group ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        <ChannelOverlay channel={conversation?.channel} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden space-y-1">
        {/* Row 1: Name (left) + time (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className={cn(
            'font-semibold text-sm truncate min-w-0 flex-1',
            contact.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'
          )}>
            {contact.name}
          </span>
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
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className={cn(
            'text-xs flex-1 min-w-0 truncate',
            contact.unread_count > 0 ? 'text-foreground/80' : 'text-muted-foreground'
          )}>
            <MessagePreview text={contact.last_message_text || undefined} />
          </div>
          {contact.unread_count > 0 ? (
            <span className="flex-shrink-0 bg-emerald-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-sm">
              {contact.unread_count > 99 ? '99+' : contact.unread_count}
            </span>
          ) : (
            <span className="flex-shrink-0 w-5" aria-hidden />
          )}
        </div>

        {/* Row 3: Tags — fila → SLA → atribuído → extras */}
        <div className="flex items-center gap-1 flex-nowrap min-w-0 overflow-hidden">
          {queueName && (
            <span className="flex-shrink min-w-0 max-w-[110px] truncate">
              <Pill label={queueName.toUpperCase()} className="bg-blue-600 text-white" />
            </span>
          )}
          {slaEvaluation && <span className="flex-shrink-0"><SlaBadge evaluation={slaEvaluation} compact /></span>}
          <span className="flex-shrink min-w-0 max-w-[110px] truncate">
            <Pill
              label={assignedAgentName ? assignedAgentName.toUpperCase() : 'NÃO ATRIBUÍDO'}
              className={assignedAgentName ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground'}
            />
          </span>
          {extraBadges.slice(0, 1).map((b, i) => (
            <span key={i} className="flex-shrink min-w-0 max-w-[100px] truncate">
              <Pill label={b.label} className={b.className} />
            </span>
          ))}
        </div>
      </div>
    </button>
  );
});
