import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, MessageSquare, MessageCircle, Globe, Instagram, Camera, Video, Mic, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, differenceInDays, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatContact } from '@/types/chat';
import type { ChatConversation } from '@/types/conversation';

interface ChatContactItemProps {
  contact: ChatContact;
  isSelected: boolean;
  onClick: () => void;
  conversation?: ChatConversation;
}

function ChannelIcon({ channel }: { channel?: string }) {
  switch (channel) {
    case 'whatsapp_waba':
      return <MessageCircle className="h-3 w-3 text-emerald-600" />;
    case 'webchat':
      return <Globe className="h-3 w-3 text-blue-500" />;
    case 'instagram':
      return <Instagram className="h-3 w-3 text-pink-500" />;
    default:
      return <MessageCircle className="h-3 w-3 text-emerald-500" />;
  }
}

/** WhatsApp-style time formatting */
function formatWhatsAppTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEEE', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  return format(date, 'dd/MM/yyyy');
}

/** Message preview with media type icon */
function MessagePreview({ text, type }: { text?: string; type?: string }) {
  if (!text && !type) return null;

  // Detect media type from text like "[image]" or from type field
  const mediaType = type || (text?.match(/^\[(\w+)\]$/)?.[1]);
  
  const mediaIcons: Record<string, React.ReactNode> = {
    image: <><Camera className="h-3 w-3 text-muted-foreground inline mr-1 flex-shrink-0" /> Foto</>,
    video: <><Video className="h-3 w-3 text-muted-foreground inline mr-1 flex-shrink-0" /> Vídeo</>,
    audio: <><Mic className="h-3 w-3 text-muted-foreground inline mr-1 flex-shrink-0" /> Áudio</>,
    ptt: <><Mic className="h-3 w-3 text-muted-foreground inline mr-1 flex-shrink-0" /> Áudio</>,
    document: <><FileText className="h-3 w-3 text-muted-foreground inline mr-1 flex-shrink-0" /> Documento</>,
    sticker: <>🏷️ Sticker</>,
  };

  if (mediaType && mediaIcons[mediaType]) {
    return <span className="flex items-center text-sm text-muted-foreground truncate">{mediaIcons[mediaType]}</span>;
  }

  return <span className="truncate">{text}</span>;
}

export const ChatContactItem = React.memo(function ChatContactItem({
  contact,
  isSelected,
  onClick,
  conversation,
}: ChatContactItemProps) {
  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const formattedTime = contact.last_message_at
    ? formatWhatsAppTime(contact.last_message_at)
    : null;

  const statusIndicator = conversation ? {
    pending: { color: 'bg-yellow-500', icon: <Clock className="h-2.5 w-2.5" /> },
    open: { color: 'bg-emerald-500', icon: <MessageSquare className="h-2.5 w-2.5" /> },
  }[conversation.status] : null;

  const waitingMinutes = conversation?.status === 'pending' && conversation.opened_at
    ? differenceInMinutes(new Date(), new Date(conversation.opened_at))
    : null;

  const waitingLabel = waitingMinutes !== null
    ? waitingMinutes < 60
      ? `${waitingMinutes}min`
      : `${Math.floor(waitingMinutes / 60)}h${waitingMinutes % 60 > 0 ? `${waitingMinutes % 60}m` : ''}`
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 text-left transition-colors rounded-lg',
        'hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {contact.is_group ? <Users className="h-5 w-5" /> : initials}
          </AvatarFallback>
        </Avatar>
        
        {statusIndicator && (
          <div className={cn(
            'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center',
            statusIndicator.color
          )}>
            <span className="text-white">{statusIndicator.icon}</span>
          </div>
        )}
        
        {contact.unread_count > 0 && (
          <Badge
            variant="default"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
          >
            {contact.unread_count > 99 ? '99+' : contact.unread_count}
          </Badge>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChannelIcon channel={conversation?.channel} />
            <span className={cn(
              'font-medium truncate',
              contact.unread_count > 0 && 'text-foreground'
            )}>
              {contact.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {waitingLabel && (
              <Badge variant="outline" className={cn(
                'text-[9px] px-1.5 h-4 gap-0.5 border',
                waitingMinutes! > 30
                  ? 'text-destructive border-destructive/30 bg-destructive/5'
                  : waitingMinutes! > 10
                    ? 'text-yellow-600 border-yellow-500/30 bg-yellow-500/5'
                    : 'text-muted-foreground'
              )}>
                <Clock className="h-2.5 w-2.5" />
                {waitingLabel}
              </Badge>
            )}
            {formattedTime && (
              <span className={cn(
                'text-xs',
                contact.unread_count > 0 ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {formattedTime}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 mt-0.5">
          {conversation?.protocol && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded flex-shrink-0">
              {conversation.protocol}
            </span>
          )}
          <p className={cn(
            'text-sm truncate',
            contact.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            <MessagePreview text={contact.last_message_text || undefined} />
          </p>
        </div>
      </div>
    </button>
  );
});