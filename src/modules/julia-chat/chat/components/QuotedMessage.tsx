import React from 'react';
import { cn } from '@/lib/utils';
import { Image, FileText, Mic, Video, MapPin, User } from 'lucide-react';
import type { MessageMetadata, MessageType } from '@/types/chat';

interface QuotedMessageProps {
  quoted: NonNullable<MessageMetadata['quoted_message']>;
  className?: string;
}

function getQuotedIcon(type?: MessageType) {
  switch (type) {
    case 'image': return <Image className="h-3 w-3" />;
    case 'video': return <Video className="h-3 w-3" />;
    case 'audio':
    case 'ptt': return <Mic className="h-3 w-3" />;
    case 'document': return <FileText className="h-3 w-3" />;
    case 'location': return <MapPin className="h-3 w-3" />;
    case 'contact': return <User className="h-3 w-3" />;
    default: return null;
  }
}

function getQuotedLabel(type?: MessageType): string {
  switch (type) {
    case 'image': return 'Foto';
    case 'video': return 'Vídeo';
    case 'audio': return 'Áudio';
    case 'ptt': return 'Mensagem de voz';
    case 'document': return 'Documento';
    case 'sticker': return 'Figurinha';
    case 'location': return 'Localização';
    case 'contact': return 'Contato';
    default: return '';
  }
}

export const QuotedMessage = React.forwardRef<HTMLDivElement, QuotedMessageProps>(
  function QuotedMessage({ quoted, className }, ref) {
    const icon = getQuotedIcon(quoted.type);
    const label = getQuotedLabel(quoted.type);
    
    return (
      <div
        ref={ref}
        className={cn(
          'px-2 py-1.5 rounded border-l-2 bg-muted/50 text-xs mb-1',
          quoted.from_me ? 'border-l-primary' : 'border-l-accent-foreground/50',
          className
        )}
      >
        <p className={cn(
          'font-medium truncate',
          quoted.from_me ? 'text-primary' : 'text-accent-foreground'
        )}>
          {quoted.from_me ? 'Você' : quoted.sender_name || 'Contato'}
        </p>
        
        {quoted.text ? (
          <p className="text-muted-foreground truncate">{quoted.text}</p>
        ) : label ? (
          <p className="text-muted-foreground flex items-center gap-1">
            {icon}
            <span>{label}</span>
          </p>
        ) : null}
      </div>
    );
  }
);
