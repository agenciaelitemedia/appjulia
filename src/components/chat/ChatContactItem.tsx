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
    return <span className="flex items-center text-muted-foreground">{mediaIcons[mediaType]}</span>;
  }

  return <span className="truncate">{text}</span>;
}

/** Status/tag badges like Helena */
function ConversationBadges({ conversation, queueName, assignedAgentName }: { conversation?: ChatConversation; queueName?: string; assignedAgentName?: string }) {
  const badges: { label: string; className: string }[] = [];

  if (queueName) {
    badges.push({ label: queueName.toUpperCase(), className: 'bg-blue-600 text-white' });
  }

  // Team / assigned agent — always show, even when empty
  badges.push({
    label: assignedAgentName ? assignedAgentName.toUpperCase() : 'NÃO ATRIBUÍDO',
    className: assignedAgentName ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground',
  });

  if (conversation?.priority === 'high' || conversation?.priority === 'urgent') {
    badges.push({ label: 'PRIORIDADE', className: 'bg-red-500 text-white' });
  }
  if (conversation?.tags && conversation.tags.length > 0) {
    conversation.tags.slice(0, 2).forEach(tag => {
      badges.push({ label: tag.toUpperCase(), className: 'bg-emerald-600 text-white' });
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {badges.map((b, i) => (
        <span key={i} className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', b.className)}>
          {b.label}
        </span>
      ))}
    </div>
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

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-3',
        isSelected
          ? 'bg-accent/40 border-l-primary'
          : 'border-l-transparent hover:bg-accent/20'
      )}
    >
      {/* Avatar with channel overlay */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar className="h-10 w-10">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
            {contact.is_group ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        <ChannelOverlay channel={conversation?.channel} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: Name + Queue name */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'font-semibold text-sm truncate',
            contact.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'
          )}>
            {contact.name}
          </span>
          {/* queue name now shown as a badge in row 2 */}
        </div>

        {/* Row 2: Badges + time + unread */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            <ConversationBadges conversation={conversation} queueName={queueName} assignedAgentName={assignedAgentName} />
            {slaEvaluation && <SlaBadge evaluation={slaEvaluation} compact />}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {formattedTime && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formattedTime}
              </span>
            )}
            {contact.unread_count > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {contact.unread_count > 99 ? '99+' : contact.unread_count}
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Message preview */}
        <p className={cn(
          'text-xs truncate',
          contact.unread_count > 0 ? 'text-foreground/70' : 'text-muted-foreground'
        )}>
          <MessagePreview text={contact.last_message_text || undefined} />
        </p>
      </div>
    </button>
  );
});
