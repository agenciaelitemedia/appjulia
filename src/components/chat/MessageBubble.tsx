import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, Download, Play, Pause, Loader2, FileText, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuotedMessage } from './QuotedMessage';
import { format } from 'date-fns';
import type { ChatMessage, MessageStatus, MessageType } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  onDownloadMedia?: (messageId: string) => Promise<string | undefined>;
}

// WhatsApp text formatting
function formatWhatsAppText(text: string): React.ReactNode {
  // Replace formatting patterns
  const patterns = [
    { regex: /\*([^*]+)\*/g, render: (t: string) => <strong key={t}>{t}</strong> },
    { regex: /_([^_]+)_/g, render: (t: string) => <em key={t}>{t}</em> },
    { regex: /~([^~]+)~/g, render: (t: string) => <del key={t}>{t}</del> },
    { regex: /```([^`]+)```/g, render: (t: string) => <code key={t} className="bg-muted px-1 rounded">{t}</code> },
    { regex: /`([^`]+)`/g, render: (t: string) => <code key={t} className="bg-muted px-1 rounded">{t}</code> },
  ];

  // URL detection
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline break-all"
        >
          {part}
        </a>
      );
    }
    
    // Apply text formatting
    let formatted: React.ReactNode = part;
    for (const { regex, render } of patterns) {
      if (typeof formatted === 'string') {
        const matches = formatted.match(regex);
        if (matches) {
          formatted = formatted.replace(regex, (_, content) => `%%${content}%%`);
          formatted = (formatted as string).split('%%').map((segment, j) => 
            matches.some(m => m.includes(segment)) ? render(segment) : segment
          );
        }
      }
    }
    
    return <span key={i}>{formatted}</span>;
  });
}

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending': return <Clock className="h-3 w-3" />;
    case 'sent': return <Check className="h-3 w-3" />;
    case 'delivered': return <CheckCheck className="h-3 w-3" />;
    case 'read': return <CheckCheck className="h-3 w-3 text-primary" />;
    case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
    default: return null;
  }
}

function MediaContent({ message, onDownload }: { message: ChatMessage; onDownload?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(message.media_url);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const handleDownload = async () => {
    if (!onDownload || mediaUrl) return;
    setIsLoading(true);
    try {
      // This would call the download function
      // const url = await onDownload();
      // if (url) setMediaUrl(url);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  switch (message.type) {
    case 'image':
      return (
        <div className="relative max-w-[280px]">
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Imagem"
              className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          ) : message.metadata?.thumbnail ? (
            <div className="relative">
              <img
                src={`data:image/jpeg;base64,${message.metadata.thumbnail}`}
                alt="Preview"
                className="rounded-lg max-w-full blur-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute inset-0 m-auto w-fit"
                onClick={handleDownload}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-8 flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar imagem
              </Button>
            </div>
          )}
          {message.caption && (
            <p className="mt-1 text-sm">{formatWhatsAppText(message.caption)}</p>
          )}
        </div>
      );

    case 'video':
      return (
        <div className="relative max-w-[280px]">
          {mediaUrl ? (
            <video
              src={mediaUrl}
              controls
              className="rounded-lg max-w-full"
              preload="metadata"
            />
          ) : (
            <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-video">
              <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar vídeo
              </Button>
            </div>
          )}
          {message.caption && (
            <p className="mt-1 text-sm">{formatWhatsAppText(message.caption)}</p>
          )}
        </div>
      );

    case 'audio':
    case 'ptt':
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          {mediaUrl ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={toggleAudio}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1 h-1 bg-muted rounded-full">
                <div className="h-full bg-primary rounded-full" style={{ width: '0%' }} />
              </div>
              <span className="text-xs text-muted-foreground">
                {message.metadata?.duration ? `${Math.floor(message.metadata.duration / 60)}:${(message.metadata.duration % 60).toString().padStart(2, '0')}` : '0:00'}
              </span>
              <audio
                ref={audioRef}
                src={mediaUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Baixar áudio
            </Button>
          )}
        </div>
      );

    case 'document':
      return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[200px]">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.file_name || 'Documento'}</p>
            {message.metadata?.file_size && (
              <p className="text-xs text-muted-foreground">
                {(message.metadata.file_size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      );

    case 'location':
      return (
        <div className="p-2 bg-muted/50 rounded-lg min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {message.metadata?.location_name || 'Localização'}
            </span>
          </div>
          {message.metadata?.location_address && (
            <p className="text-xs text-muted-foreground">{message.metadata.location_address}</p>
          )}
          {message.metadata?.latitude && message.metadata?.longitude && (
            <a
              href={`https://maps.google.com/?q=${message.metadata.latitude},${message.metadata.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline mt-1 block"
            >
              Ver no mapa
            </a>
          )}
        </div>
      );

    case 'contact':
      return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <User className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{message.metadata?.contact_name || 'Contato'}</p>
            {message.metadata?.contact_phone && (
              <p className="text-xs text-muted-foreground">{message.metadata.contact_phone}</p>
            )}
          </div>
        </div>
      );

    case 'sticker':
      return mediaUrl ? (
        <img
          src={mediaUrl}
          alt="Figurinha"
          className="max-w-[128px] max-h-[128px]"
          loading="lazy"
        />
      ) : (
        <div className="bg-muted rounded-lg p-4">
          <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🖼️ Figurinha'}
          </Button>
        </div>
      );

    default:
      return null;
  }
}

export const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ message, onDownloadMedia }, ref) {
    const isMedia = ['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'contact'].includes(message.type);
    const hasQuote = message.metadata?.quoted_message;

    if (message.type === 'revoked') {
      return (
        <div
          ref={ref}
          className={cn(
            'flex',
            message.from_me ? 'justify-end' : 'justify-start'
          )}
        >
          <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground italic text-sm">
            🚫 Mensagem apagada
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          message.from_me ? 'justify-end' : 'justify-start'
        )}
      >
        <div
          className={cn(
            'max-w-[75%] rounded-lg px-3 py-2',
            message.from_me
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-muted rounded-bl-none'
          )}
        >
          {/* Sender name (groups) */}
          {!message.from_me && message.metadata?.sender_name && (
            <p className="text-xs font-medium text-primary mb-1">
              {message.metadata.sender_name}
            </p>
          )}

          {/* Quoted message */}
          {hasQuote && (
            <QuotedMessage quoted={message.metadata!.quoted_message!} />
          )}

          {/* Media content */}
          {isMedia && (
            <MediaContent 
              message={message} 
              onDownload={onDownloadMedia ? () => onDownloadMedia(message.message_id || '') : undefined}
            />
          )}

          {/* Text content */}
          {message.text && message.type === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {formatWhatsAppText(message.text)}
            </p>
          )}

          {/* Timestamp and status */}
          <div className={cn(
            'flex items-center justify-end gap-1 mt-1',
            message.from_me ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            <span className="text-[10px]">
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
            {message.from_me && <StatusIcon status={message.status} />}
          </div>
        </div>
      </div>
    );
  }
);
