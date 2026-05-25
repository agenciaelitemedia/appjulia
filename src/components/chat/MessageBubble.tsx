import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, Download, Play, Pause, Loader2, FileText, MapPin, User, StickyNote as StickyNoteIcon, Forward, Reply, WifiOff, ImageOff, RotateCw, Pencil, Lock } from 'lucide-react';
import { MediaLightbox } from './MediaLightbox';
import { Button } from '@/components/ui/button';
import { QuotedMessage } from './QuotedMessage';
import { ReactionPicker } from './ReactionPicker';
import { ExpandableMessageText } from './ExpandableMessageText';
import { TranscriptionBlock } from './messages/TranscriptionBlock';
import { format } from 'date-fns';
import type { ChatMessage, MessageStatus, MessageType } from '@/types/chat';
import type { MessageReaction } from '@/hooks/useMessageReactions';
import { type DownloadMediaResult, useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { forceDownload } from '@/lib/forceDownload';
import { useClientAutomationFlags } from '@/hooks/useClientAutomationFlags';
import { useQueueAutomationFlags } from '@/hooks/useQueueAutomationFlags';

interface MessageBubbleProps {
  message: ChatMessage;
  reactions?: MessageReaction[];
  onDownloadMedia?: (messageId: string) => Promise<DownloadMediaResult>;
  onReact?: (message: ChatMessage, emoji: string) => void;
  onForward?: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  isGroup?: boolean;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;

// WhatsApp text formatting - fixed regex bug (no global flag in test)
function formatWhatsAppText(text: string): React.ReactNode {
  const patterns = [
    { regex: /\*([^*]+)\*/g, render: (t: string, i: number) => <strong key={`b-${i}`}>{t}</strong> },
    { regex: /_([^_]+)_/g, render: (t: string, i: number) => <em key={`i-${i}`}>{t}</em> },
    { regex: /~([^~]+)~/g, render: (t: string, i: number) => <del key={`s-${i}`}>{t}</del> },
    { regex: /```([^`]+)```/g, render: (t: string, i: number) => <code key={`c-${i}`} className="bg-muted px-1 rounded">{t}</code> },
    { regex: /`([^`]+)`/g, render: (t: string, i: number) => <code key={`ic-${i}`} className="bg-muted px-1 rounded">{t}</code> },
  ];

  // Use a non-global regex for splitting to avoid lastIndex issues
  const urlPattern = /(https?:\/\/[^\s]+)/;
  const parts = text.split(urlPattern);
  
  return parts.map((part, i) => {
    // Check if this part is a URL (every other part from split is a match)
    if (i % 2 === 1) {
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
      if (typeof formatted === 'string' && regex.test(formatted)) {
        // Reset lastIndex after test
        regex.lastIndex = 0;
        const segments: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(formatted)) !== null) {
          if (match.index > lastIndex) {
            segments.push(formatted.slice(lastIndex, match.index));
          }
          segments.push(render(match[1], match.index));
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < formatted.length) {
          segments.push(formatted.slice(lastIndex));
        }
        formatted = segments;
        regex.lastIndex = 0;
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
    case 'read': return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
    default: return null;
  }
}

function MediaContent({ message, onDownload }: { message: ChatMessage; onDownload?: () => Promise<DownloadMediaResult> }) {
  const [isLoading, setIsLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(message.media_url);
  const [downloadState, setDownloadState] = useState<'idle' | 'transient' | 'permanent'>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>(message.metadata?.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Gate de transcrição: precisa estar habilitado no client (master) E na fila
  // dona da CONVERSA (não a fila selecionada no topo). Após a deduplicação por
  // contato, a conversa exibida pode estar em uma fila diferente da do filtro.
  const { selectedQueue, selectedConversation } = useWhatsAppData();
  const effectiveQueueId = selectedConversation?.queue_id ?? selectedQueue?.id ?? null;
  const { flags: clientFlags } = useClientAutomationFlags();
  const { flags: queueFlags } = useQueueAutomationFlags(effectiveQueueId);
  const canTranscribe = clientFlags.autoTranscribeAudio && queueFlags.autoTranscribeAudio;

  // Sync local URL with prop when parent updates message
  useEffect(() => {
    if (message.media_url && message.media_url !== mediaUrl) {
      setMediaUrl(message.media_url);
    }
  // mediaUrl is intentionally excluded — including it would create an infinite update loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.media_url]);

  const isEncrypted = (u?: string) => !u || u.includes('.enc') || u.includes('mmg.whatsapp.net');

  const handleDownload = async () => {
    if (!onDownload) return;
    if (mediaUrl && !isEncrypted(mediaUrl)) return;
    setIsLoading(true);
    try {
      const res = await onDownload();
      if (res?.url) {
        setMediaUrl(res.url);
        setDownloadState('idle');
      } else if (res?.permanent) {
        setDownloadState('permanent');
      } else if (res?.transient) {
        setDownloadState('transient');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentDownload = async () => {
    if (mediaUrl && !isEncrypted(mediaUrl)) {
      forceDownload(mediaUrl, message.file_name);
      return;
    }
    if (!onDownload) return;
    setIsLoading(true);
    try {
      const res = await onDownload();
      if (res?.url) {
        setMediaUrl(res.url);
        setDownloadState('idle');
        forceDownload(res.url, message.file_name);
      } else if (res?.permanent) {
        setDownloadState('permanent');
      } else if (res?.transient) {
        setDownloadState('transient');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch for image/video/audio/sticker on mount (WhatsApp Web behavior)
  useEffect(() => {
    if (!onDownload) return;
    const autoTypes = ['image', 'video', 'audio', 'ptt', 'sticker'];
    if (!autoTypes.includes(message.type)) return;
    if (mediaUrl && !isEncrypted(mediaUrl)) return;
    if (downloadState === 'permanent') return;
    handleDownload();
    // runs only when message.id changes — handleDownload is intentionally excluded to avoid re-fetching on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      setAudioCurrent(currentTime || 0);
      if (duration && !isNaN(duration) && isFinite(duration)) {
        setAudioProgress((currentTime / duration) * 100);
        setAudioDuration(duration);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const dur = audioRef.current.duration;
    if (dur && isFinite(dur)) {
      audioRef.current.currentTime = ratio * dur;
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const usable = mediaUrl && !isEncrypted(mediaUrl);

  const FallbackBox = ({ label }: { label: string }) => {
    if (downloadState === 'permanent') {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <span>Mídia não disponível neste histórico</span>
          {onDownload && (
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleDownload} disabled={isLoading}>
              <RotateCw className="h-3 w-3 mr-1" /> Tentar
            </Button>
          )}
        </div>
      );
    }
    if (downloadState === 'transient') {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="h-4 w-4" />
          <span>Mídia indisponível</span>
        </div>
      );
    }
    return (
      <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
        {label}
      </Button>
    );
  };

  switch (message.type) {
    case 'image':
      return (
        <>
          <div className="relative max-w-[280px]">
            {usable ? (
              <div className="relative group">
                <img
                  src={mediaUrl}
                  alt={message.caption || 'Imagem'}
                  className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                  loading="lazy"
                  onClick={() => setLightboxOpen(true)}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); forceDownload(mediaUrl!, message.file_name); }}
                  aria-label="Baixar imagem"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ) : message.metadata?.thumbnail ? (
              <div className="relative">
                <img
                  src={`data:image/jpeg;base64,${message.metadata.thumbnail}`}
                  alt="Preview"
                  className="rounded-lg max-w-full blur-sm"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                </div>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-8 flex items-center justify-center min-h-[180px] min-w-[200px]">
                {isLoading && downloadState === 'idle' ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <FallbackBox label="Baixar imagem" />
                )}
              </div>
            )}
            {message.caption && (
              <div className="mt-1"><ExpandableMessageText text={message.caption} formatter={formatWhatsAppText} /></div>
            )}
          </div>
          <MediaLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            url={mediaUrl || null}
            caption={message.caption}
            fileName={message.file_name}
          />
        </>
      );

    case 'video':
      return (
        <>
        <div className="relative max-w-[280px]">
          {usable ? (
            <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
              <video
                src={mediaUrl}
                className="rounded-lg max-w-full pointer-events-none"
                preload="metadata"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20 group-hover:bg-black/30 transition-colors">
                <div className="h-12 w-12 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                  <Play className="h-6 w-6 text-foreground fill-foreground" />
                </div>
              </div>
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); forceDownload(mediaUrl!, message.file_name); }}
                aria-label="Baixar vídeo"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-8 flex items-center justify-center aspect-video">
              {isLoading && downloadState === 'idle' ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <FallbackBox label="Baixar vídeo" />
              )}
            </div>
          )}
          {message.caption && (
            <div className="mt-1"><ExpandableMessageText text={message.caption} formatter={formatWhatsAppText} /></div>
          )}
        </div>
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          url={mediaUrl || null}
          caption={message.caption}
          fileName={message.file_name}
          kind="video"
        />
        </>
      );

    case 'audio':
    case 'ptt':
      return (
        <div className="flex flex-col gap-1 min-w-[240px]">
          <div className="flex items-center gap-2">
          {usable ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                onClick={toggleAudio}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1 flex flex-col gap-1">
                <div
                  className="h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer"
                  onClick={handleSeek}
                  role="slider"
                  aria-label="Posição do áudio"
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-100"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-mono">{formatDuration(audioCurrent)}</span>
                  <span className="font-mono">{formatDuration(audioDuration)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] font-mono shrink-0"
                onClick={cyclePlaybackRate}
                aria-label="Velocidade"
              >
                {playbackRate}x
              </Button>
              <audio
                ref={audioRef}
                src={mediaUrl}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onEnded={() => { setIsPlaying(false); setAudioProgress(0); setAudioCurrent(0); }}
                className="hidden"
              />
            </>
          ) : (
            <div className="flex items-center gap-2 py-1">
              {isLoading && downloadState === 'idle' ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <FallbackBox label="Baixar áudio" />
              )}
            </div>
          )}
          </div>
          <TranscriptionBlock
            transcription={message.metadata?.transcription}
            messageId={message.id}
            canGenerate={canTranscribe}
          />
        </div>
      );

    case 'document':
      return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[200px]">
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.file_name || 'Documento'}</p>
            {message.metadata?.file_size && (
              <p className="text-xs text-muted-foreground">
                {(message.metadata.file_size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDocumentDownload}
            disabled={isLoading}
            aria-label="Baixar documento"
          >
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
      return usable ? (
        <img
          src={mediaUrl}
          alt="Figurinha"
          className="max-w-[128px] max-h-[128px]"
          loading="lazy"
        />
      ) : (
        <div className="bg-muted rounded-lg p-4 min-w-[100px] min-h-[100px] flex items-center justify-center">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🖼️'}
        </div>
      );

    default:
      return null;
  }
}


export const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ message, reactions, onDownloadMedia, onReact, onForward, onReply, onEdit, isGroup }, ref) {
    const isMedia = ['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'contact'].includes(message.type);
    const hasQuote = message.metadata?.quoted_message;
    const isInternalNote = !!message.metadata?.internal_note;

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

    // Internal note styling
    if (isInternalNote) {
      const senderName = message.metadata?.sender_name;
      const isClosureNote = !!message.metadata?.closure_note;
      const noteType = (message.metadata?.note_type || 'info') as 'info' | 'question' | 'urgent';
      const noteStyles = {
        info: {
          container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300/50 dark:border-blue-700/40',
          icon: 'text-blue-600 dark:text-blue-400',
          label: 'text-blue-700 dark:text-blue-300',
          body: 'text-blue-900 dark:text-blue-100',
          time: 'text-blue-500/70',
          title: 'Nota Informativa',
        },
        question: {
          container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400/60 dark:border-yellow-600/40',
          icon: 'text-yellow-700 dark:text-yellow-400',
          label: 'text-yellow-800 dark:text-yellow-300',
          body: 'text-yellow-900 dark:text-yellow-100',
          time: 'text-yellow-600/70',
          title: 'Nota de Dúvida',
        },
        urgent: {
          container: 'bg-red-50 dark:bg-red-900/20 border-red-400/60 dark:border-red-600/40',
          icon: 'text-red-600 dark:text-red-400',
          label: 'text-red-700 dark:text-red-300',
          body: 'text-red-900 dark:text-red-100',
          time: 'text-red-500/70',
          title: isClosureNote ? 'Nota de Encerramento' : 'Nota de Urgência',
        },
      }[noteType];
      const NoteIcon = isClosureNote ? Lock : StickyNoteIcon;
      return (
        <div ref={ref} className="flex justify-center px-4">
          <div className={cn('max-w-[85%] w-full rounded-lg px-3 py-2 shadow-sm border', noteStyles.container)}>
            <div className="flex items-center gap-1.5 mb-1">
              <NoteIcon className={cn('h-3 w-3', noteStyles.icon)} />
              <span className={cn('text-[10px] font-semibold', noteStyles.label)}>
                {noteStyles.title} {senderName ? `— ${senderName}` : ''}
              </span>
            </div>
            {message.text && (
              <ExpandableMessageText
                text={message.text}
                formatter={formatWhatsAppText}
                className={noteStyles.body}
              />
            )}
            <div className={cn('flex items-center justify-end gap-1 mt-1', noteStyles.time)}>
              <span className="text-[10px]">
                {format(new Date(message.timestamp), 'HH:mm')}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Aggregate reactions by emoji
    const grouped: Record<string, MessageReaction[]> = {};
    (reactions || []).forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r);
    });

    return (
      <div
        ref={ref}
        className={cn(
          'flex group',
          message.from_me ? 'justify-end' : 'justify-start'
        )}
      >
        <div className="flex items-end gap-1 max-w-[75%]">
          {/* Action buttons (forward + react) — left of bubble for incoming, right for outgoing */}
          {message.from_me && (
            <div className="flex flex-col gap-0.5 items-center">
              {onReact && <ReactionPicker onSelect={(emoji) => onReact(message, emoji)} side="top" align="end" />}
              {onEdit && message.type === 'text'
                && !(message.external_id?.startsWith('wamid.') || message.message_id?.startsWith('wamid.'))
                && (Date.now() - new Date(message.timestamp).getTime() <= EDIT_WINDOW_MS) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEdit(message)}
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onReply && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onReply(message)}
                  aria-label="Responder"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}
              {onForward && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onForward(message)}
                  aria-label="Encaminhar"
                >
                  <Forward className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col items-stretch min-w-0">
            <div
              className={cn(
                'rounded-lg px-3 py-2',
                message.from_me
                  ? 'bg-green-100 dark:bg-green-900/30 text-foreground rounded-br-none'
                  : 'bg-muted text-foreground border border-border/50 rounded-bl-none'
              )}
            >
              {/* Sender name (groups) */}
              {!message.from_me && isGroup && message.metadata?.sender_name && (
                <p className="text-xs font-medium text-primary mb-1">
                  {message.metadata.sender_name}
                </p>
              )}

              {/* Forwarded label */}
              {message.is_forwarded && (
                <div className="flex items-center gap-1 mb-1 text-xs italic text-muted-foreground">
                  <Forward className="h-3 w-3" />
                  Encaminhada
                </div>
              )}

              {/* Quoted message */}
              {hasQuote && (
                <QuotedMessage quoted={message.metadata!.quoted_message!} />
              )}

              {/* Media content */}
              {isMedia && (
                <MediaContent
                  message={message}
                  onDownload={onDownloadMedia ? () => onDownloadMedia(message.message_id || message.id) : undefined}
                />
              )}

              {/* Text content */}
              {message.text && message.type === 'text' && (
                <ExpandableMessageText text={message.text} formatter={formatWhatsAppText} />
              )}

              {/* Timestamp and status */}
              <div className={cn(
                'flex items-center justify-end gap-1 mt-1',
                message.from_me ? 'text-foreground/60' : 'text-muted-foreground'
              )}>
                {message.edited_at && (
                  <span className="text-[10px] italic opacity-70">editada</span>
                )}
                <span className="text-[10px]">
                  {format(new Date(message.timestamp), 'HH:mm')}
                </span>
                {message.from_me && <StatusIcon status={message.status} />}
                {!message.from_me && (
                  <CheckCheck className="h-3 w-3 text-sky-500" />
                )}
              </div>
            </div>

            {/* Reaction badges */}
            {Object.keys(grouped).length > 0 && (
              <div className={cn(
                'flex gap-1 mt-1 flex-wrap',
                message.from_me ? 'justify-end' : 'justify-start'
              )}>
                {Object.entries(grouped).map(([emoji, list]) => (
                  <div
                    key={emoji}
                    className="bg-background border rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center gap-1"
                    title={list.map((r) => r.reactor).join(', ')}
                  >
                    <span>{emoji}</span>
                    {list.length > 1 && (
                      <span className="text-muted-foreground text-[10px]">{list.length}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!message.from_me && (
            <div className="flex flex-col gap-0.5 items-center">
              {onReact && <ReactionPicker onSelect={(emoji) => onReact(message, emoji)} side="top" align="start" />}
              {onReply && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onReply(message)}
                  aria-label="Responder"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}
              {onForward && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onForward(message)}
                  aria-label="Encaminhar"
                >
                  <Forward className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);
