import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Loader2, 
  Mic, FileText, Download, MapPin, User, Image as ImageIcon, Video, Play, Bot
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { externalDb } from '@/lib/externalDb';
import { SessionStatusDialog } from './SessionStatusDialog';
import { UaZapiClient } from '@/lib/uazapi';
import { supabase } from '@/integrations/supabase/client';
import { formatTimeSaoPaulo, formatDateShortSaoPaulo } from '@/lib/dateUtils';

// ============================================
// Types
// ============================================

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';

type WhatsAppProvider = 'uazapi' | 'waba';

interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  type: MessageType;
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
  seconds?: number;
  ptt?: boolean;
  thumbnail?: string;
  latitude?: number;
  longitude?: number;
  // Quoted message fields
  quotedId?: string;
  quotedText?: string;
  quotedParticipant?: string;
  // WABA media ID for download
  wabaMediaId?: string;
}

interface AgentCredentials {
  api_url: string;
  api_key: string;
  api_instance?: string;
  hub?: string;
  waba_id?: string;
  waba_number_id?: string;
}

interface WhatsAppMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  leadName?: string;
  codAgent: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normaliza timestamps para milissegundos.
 * Detecta automaticamente se o valor está em segundos ou milissegundos.
 */
function normalizeTimestamp(timestamp: number | string): number {
  if (typeof timestamp === 'string') {
    // Tentar parse de ISO string
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) return parsed;
    // Tentar converter string numérica
    timestamp = parseInt(timestamp, 10);
  }
  
  if (!timestamp || isNaN(Number(timestamp))) return Date.now();
  
  const numTimestamp = Number(timestamp);
  
  // Timestamps em segundos têm ~10 dígitos (até 2033)
  // Timestamps em milissegundos têm ~13 dígitos
  // Se for maior que 10 bilhões, já está em milissegundos
  if (numTimestamp > 10000000000) {
    return numTimestamp;
  } else {
    // Está em segundos, converter para milissegundos
    return numTimestamp * 1000;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Aplica formatação de texto estilo WhatsApp
function applyWhatsAppFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  
  // Regex combinada para capturar todos os padrões de formatação
  // Ordem: código primeiro (para evitar conflitos), depois negrito, itálico, tachado
  const formatRegex = /`([^`]+)`|\*([^\s*][^*]*[^\s*]|\S)\*|_([^\s_][^_]*[^\s_]|\S)_|~([^\s~][^~]*[^\s~]|\S)~/g;
  
  let match;
  while ((match = formatRegex.exec(text)) !== null) {
    // Adicionar texto antes do match
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }
    
    const key = `${keyPrefix}-fmt-${keyCounter++}`;
    
    if (match[1] !== undefined) {
      // Código: `texto`
      result.push(
        <code key={key} className="bg-background/30 px-1 py-0.5 rounded text-xs font-mono">
          {match[1]}
        </code>
      );
    } else if (match[2] !== undefined) {
      // Negrito: *texto*
      result.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // Itálico: _texto_
      result.push(<em key={key}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // Tachado: ~texto~
      result.push(<del key={key} className="opacity-70">{match[4]}</del>);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Adicionar texto restante
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }
  
  return result.length > 0 ? result : [text];
}

// Transforma URLs em links clicáveis e aplica formatação WhatsApp
function renderTextWithLinks(text: string | null | undefined): React.ReactNode {
  // Garantir que text é uma string válida
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') {
    // Se não for string, tenta converter
    text = String(text);
  }
  if (!text) return null;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex
      urlRegex.lastIndex = 0;
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // Aplicar formatação WhatsApp ao texto que não é URL
    return <span key={`text-${index}`}>{applyWhatsAppFormatting(part, `p${index}`)}</span>;
  });
}

// Formata o participante da mensagem citada
function formatQuotedParticipant(participant?: string): string {
  if (!participant) return '';
  // Remove sufixos como @s.whatsapp.net ou @lid
  const cleaned = participant.replace(/@[^@]+$/, '');
  // Se for número, formata como telefone
  if (/^\d+$/.test(cleaned)) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  }
  return cleaned;
}

// Componente para exibir mensagem citada
import React from 'react';

const QuotedMessage = React.forwardRef<
  HTMLDivElement,
  { text?: string; participant?: string; isFromMe: boolean }
>(({ text, participant, isFromMe }, ref) => {
  if (!text) return null;
  
  return (
    <div 
      ref={ref}
      className={cn(
        "border-l-2 pl-2 mb-2 text-xs rounded-r",
        isFromMe 
          ? "border-primary/60 bg-primary-foreground/10" 
          : "border-primary/80 bg-background/30"
      )}
    >
      {participant && (
        <span className="font-medium text-primary block text-[11px]">
          {formatQuotedParticipant(participant)}
        </span>
      )}
      <span className={cn(
        "line-clamp-2 break-words",
        isFromMe ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {text}
      </span>
    </div>
  );
});
QuotedMessage.displayName = 'QuotedMessage';

function detectMessageType(message: any): MessageType {
  if (!message || typeof message !== 'object') return 'unknown';
  
  // Formato UaZapi - verificar messageType PRIMEIRO (mais específico)
  if (message.messageType) {
    const typeMap: Record<string, MessageType> = {
      'ExtendedTextMessage': 'text',
      'ImageMessage': 'image',
      'AudioMessage': 'audio',
      'VideoMessage': 'video',
      'DocumentMessage': 'document',
      'StickerMessage': 'sticker',
      'LocationMessage': 'location',
      'ContactMessage': 'contact',
      'conversation': 'text',
      'text': 'text',
      'chat': 'text',
      'image': 'image',
      'audio': 'audio',
      'ptt': 'audio',
      'video': 'video',
      'document': 'document',
      'sticker': 'sticker',
      'location': 'location',
      'vcard': 'contact',
      'contact': 'contact',
    };
    if (typeMap[message.messageType]) {
      return typeMap[message.messageType];
    }
  }
  
  // Formato Baileys padrão
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.audioMessage) return 'audio';
  if (message.videoMessage) return 'video';
  if (message.documentMessage || message.documentWithCaptionMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  if (message.locationMessage) return 'location';
  if (message.contactMessage || message.contactsArrayMessage) return 'contact';
  
  // Formato alternativo UaZapi - verificar campo 'type' direto
  if (message.type) {
    const typeMap: Record<string, MessageType> = {
      'text': 'text',
      'chat': 'text',
      'conversation': 'text',
      'extendedTextMessage': 'text',
      'image': 'image',
      'imageMessage': 'image',
      'audio': 'audio',
      'ptt': 'audio',
      'audioMessage': 'audio',
      'video': 'video',
      'videoMessage': 'video',
      'document': 'document',
      'documentMessage': 'document',
      'sticker': 'sticker',
      'stickerMessage': 'sticker',
      'location': 'location',
      'locationMessage': 'location',
      'vcard': 'contact',
      'contact': 'contact',
      'contactMessage': 'contact',
    };
    return typeMap[message.type] || 'unknown';
  }
  
  // UaZapi: Verificar se tem fileURL (indica mídia)
  if (message.fileURL) {
    if (message.mimetype?.startsWith('image/')) return 'image';
    if (message.mimetype?.startsWith('video/')) return 'video';
    if (message.mimetype?.startsWith('audio/')) return 'audio';
    return 'document';
  }
  
  // Verificar se texto está em 'body' ou 'text' direto
  if (message.body || (typeof message.text === 'string') || (message.content && typeof message.content === 'object' && message.content.text)) return 'text';
  
  return 'unknown';
}

function extractMediaData(message: any, type: MessageType): Partial<Message> {
  if (!message) return { text: '[Mensagem vazia]' };
  
  switch (type) {
    case 'text': {
      // Prioridade de extração de texto - evitar [object Object]
      let textContent = '';
      
      if (message.conversation) {
        textContent = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        textContent = message.extendedTextMessage.text;
      } else if (typeof message.text === 'string') {
        textContent = message.text;
      } else if (message.content && typeof message.content === 'object' && typeof message.content.text === 'string') {
        // UaZapi: content é objeto com campo text
        textContent = message.content.text;
      } else if (typeof message.content === 'string') {
        textContent = message.content;
      } else if (typeof message.body === 'string') {
        textContent = message.body;
      }
      
      return { text: textContent || '' };
    }
      
    case 'image': {
      // Suportar formato Baileys e UaZapi
      const imageUrl = message.imageMessage?.url || message.fileURL;
      const imageCaption = message.imageMessage?.caption 
        || (message.content && typeof message.content === 'object' ? message.content.caption : undefined)
        || message.caption;
      const imageMime = message.imageMessage?.mimetype || message.mimetype;
      
      return {
        mediaUrl: imageUrl,
        caption: imageCaption,
        mimetype: imageMime,
        thumbnail: message.imageMessage?.jpegThumbnail || message.thumbnail,
        text: imageCaption || '[Imagem]',
      };
    }
      
    case 'audio': {
      const audioUrl = message.audioMessage?.url || message.fileURL;
      const audioSeconds = message.audioMessage?.seconds || message.seconds;
      
      return {
        mediaUrl: audioUrl,
        seconds: audioSeconds,
        ptt: message.audioMessage?.ptt ?? message.ptt ?? false,
        mimetype: message.audioMessage?.mimetype || message.mimetype,
        text: `[Áudio ${formatDuration(audioSeconds)}]`,
      };
    }
      
    case 'video': {
      const videoUrl = message.videoMessage?.url || message.fileURL;
      const videoCaption = message.videoMessage?.caption 
        || (message.content && typeof message.content === 'object' ? message.content.caption : undefined)
        || message.caption;
      
      return {
        mediaUrl: videoUrl,
        caption: videoCaption,
        mimetype: message.videoMessage?.mimetype || message.mimetype,
        seconds: message.videoMessage?.seconds || message.seconds,
        thumbnail: message.videoMessage?.jpegThumbnail || message.thumbnail,
        text: videoCaption || '[Vídeo]',
      };
    }
      
    case 'document': {
      const doc = message.documentMessage 
        || message.documentWithCaptionMessage?.message?.documentMessage;
      const docUrl = doc?.url || message.fileURL;
      const docName = doc?.fileName || doc?.title || message.fileName || message.title;
      
      return {
        mediaUrl: docUrl,
        fileName: docName,
        mimetype: doc?.mimetype || message.mimetype,
        caption: doc?.caption || message.caption,
        text: docName || '[Documento]',
      };
    }
      
    case 'sticker':
      return {
        mediaUrl: message.stickerMessage?.url || message.fileURL,
        mimetype: message.stickerMessage?.mimetype || message.mimetype,
        text: '[Sticker]',
      };
      
    case 'location':
      return {
        latitude: message.locationMessage?.degreesLatitude || message.latitude,
        longitude: message.locationMessage?.degreesLongitude || message.longitude,
        text: message.locationMessage?.name || message.name || '[Localização]',
      };
      
    case 'contact': {
      const contact = message.contactMessage || message.contactsArrayMessage?.contacts?.[0];
      return {
        text: contact?.displayName || message.displayName || '[Contato]',
      };
    }
      
    default:
      return {
        text: '[Mensagem não suportada]',
      };
  }
}

// ============================================
// MessageBubble Component
// ============================================

interface MessageBubbleProps {
  message: Message;
  onDownload?: (messageId: string) => void;
  isDownloading?: boolean;
  downloadedUrl?: string;
}

const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ message, onDownload, isDownloading, downloadedUrl }, ref) => {
    const isFromMe = message.fromMe;
    
    // Para mídia: usar downloadedUrl > mediaUrl
    const effectiveMediaUrl = downloadedUrl || message.mediaUrl;
    
    const renderContent = () => {
      switch (message.type) {
        case 'text':
          return (
            <div>
              <QuotedMessage 
                text={message.quotedText} 
                participant={message.quotedParticipant}
                isFromMe={isFromMe}
              />
              <p className="text-sm whitespace-pre-wrap break-words">
                {renderTextWithLinks(message.text)}
              </p>
            </div>
          );
          
        case 'image': {
          const imageUrl = effectiveMediaUrl;
          const showThumbnail = !imageUrl && message.thumbnail;
          
          return (
            <div className="space-y-1">
              {imageUrl ? (
                <div className="relative max-w-[330px] overflow-hidden rounded-lg">
                  <img 
                    src={imageUrl}
                    alt="Imagem" 
                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer rounded-lg"
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                </div>
              ) : showThumbnail ? (
                <div className="relative max-w-[330px] overflow-hidden rounded-lg">
                  <img 
                    src={`data:image/jpeg;base64,${message.thumbnail}`}
                    alt="Imagem (preview)" 
                    className="w-full h-auto max-h-[400px] object-contain rounded-lg opacity-80"
                  />
                  {isDownloading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  ) : (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload?.(message.id);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                        <Download className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg bg-muted/50",
                    onDownload && "cursor-pointer hover:bg-muted/70"
                  )}
                  onClick={() => onDownload?.(message.id)}
                >
                  {isDownloading ? (
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isDownloading ? 'Baixando imagem...' : 'Clique para carregar imagem'}
                  </span>
                </div>
              )}
              {message.caption && (
                <p className="text-sm whitespace-pre-wrap break-words mt-1">
                  {renderTextWithLinks(message.caption)}
                </p>
              )}
            </div>
          );
        }
          
        case 'audio': {
          const audioUrl = effectiveMediaUrl;
          
          return (
            <div className="flex items-center gap-2 min-w-[200px]">
              {message.ptt && (
                <Mic className="h-4 w-4 flex-shrink-0 text-green-500" />
              )}
              
              {audioUrl ? (
                <audio 
                  controls 
                  src={audioUrl} 
                  className="flex-1 h-8 max-w-[200px]"
                  preload="metadata"
                />
              ) : (
                <div 
                  className={cn(
                    "flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80",
                    isDownloading && "pointer-events-none"
                  )}
                  onClick={() => onDownload?.(message.id)}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Carregando...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center flex-shrink-0">
                        <Play className="h-4 w-4 text-primary-foreground fill-current ml-0.5" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                        <span className="text-[10px] text-muted-foreground mt-1">
                          {formatDuration(message.seconds)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }
          
        case 'video': {
          const videoUrl = effectiveMediaUrl;
          const showThumbnail = !videoUrl && message.thumbnail;
          
          return (
            <div className="space-y-1">
              {videoUrl ? (
                <div className="relative max-w-[330px] overflow-hidden rounded-lg">
                  <video 
                    controls 
                    src={videoUrl} 
                    className="w-full h-auto max-h-[400px] object-contain rounded-lg"
                    preload="metadata"
                    poster={message.thumbnail ? `data:image/jpeg;base64,${message.thumbnail}` : undefined}
                  />
                </div>
              ) : showThumbnail ? (
                <div 
                  className="relative max-w-[330px] overflow-hidden rounded-lg cursor-pointer"
                  onClick={() => !isDownloading && onDownload?.(message.id)}
                >
                  <img 
                    src={`data:image/jpeg;base64,${message.thumbnail}`}
                    alt="Video thumbnail" 
                    className="w-full h-auto max-h-[400px] object-contain rounded-lg opacity-80"
                  />
                  {isDownloading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center hover:bg-black/10 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="h-7 w-7 text-white fill-white ml-1" />
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {isDownloading ? 'Baixando...' : 'Clique para baixar'}
                  </span>
                </div>
              ) : (
                <div 
                  className={cn(
                    "flex items-center gap-2 p-4 bg-muted/50 rounded-lg max-w-[330px]",
                    onDownload && "cursor-pointer hover:bg-muted/70"
                  )}
                  onClick={() => onDownload?.(message.id)}
                >
                  {isDownloading ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  ) : (
                    <Video className="h-6 w-6 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isDownloading ? 'Baixando vídeo...' : 'Clique para carregar vídeo'}
                  </span>
                </div>
              )}
              {message.caption && (
                <p className="text-sm whitespace-pre-wrap break-words mt-1">
                  {renderTextWithLinks(message.caption)}
                </p>
              )}
            </div>
          );
        }
          
        case 'document':
          return (
            <a 
              href={effectiveMediaUrl || '#'} 
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 p-2 rounded transition-colors",
                isFromMe ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-background/50 hover:bg-background/80"
              )}
              onClick={(e) => {
                if (!effectiveMediaUrl) {
                  e.preventDefault();
                  onDownload?.(message.id);
                }
              }}
            >
              {isDownloading ? (
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
              ) : (
                <FileText className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm truncate flex-1 max-w-[150px]">
                {message.fileName || 'Documento'}
              </span>
              {effectiveMediaUrl && <Download className="h-4 w-4 flex-shrink-0" />}
            </a>
          );
          
        case 'sticker':
          return (
            <img 
              src={effectiveMediaUrl} 
              alt="Sticker" 
              className="max-w-[150px] max-h-[150px] object-contain"
              onError={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = '<span class="text-muted-foreground text-sm">[Sticker]</span>';
                }
              }}
            />
          );
          
        case 'location':
          return (
            <a
              href={message.latitude && message.longitude 
                ? `https://www.google.com/maps?q=${message.latitude},${message.longitude}` 
                : '#'
              }
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 p-2 rounded transition-colors",
                isFromMe ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-background/50 hover:bg-background/80"
              )}
            >
              <MapPin className="h-5 w-5 text-red-500" />
              <span className="text-sm">{message.text}</span>
            </a>
          );
          
        case 'contact':
          return (
            <div className="flex items-center gap-2 p-2">
              <User className="h-5 w-5 text-blue-500" />
              <span className="text-sm">{message.text}</span>
            </div>
          );
          
        default:
          return (
            <p className="text-sm italic text-muted-foreground">
              {message.text || '[Mensagem não suportada]'}
            </p>
          );
      }
    };
    
    return <div ref={ref}>{renderContent()}</div>;
  }
);
MessageBubble.displayName = 'MessageBubble';

// ============================================
// Main Component
// ============================================

export function WhatsAppMessagesDialog({
  open,
  onOpenChange,
  whatsappNumber,
  leadName,
  codAgent,
}: WhatsAppMessagesDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [client, setClient] = useState<UaZapiClient | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const [provider, setProvider] = useState<WhatsAppProvider>('uazapi');
  const [wabaContactId, setWabaContactId] = useState<string | null>(null);
  const [wabaClientId, setWabaClientId] = useState<string | null>(null);
  
  // Media download state
  const [downloadingMedia, setDownloadingMedia] = useState<Set<string>>(new Set());
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
   
  // Session status inline state
  const [sessionData, setSessionData] = useState<import('@/lib/externalDb').SessionStatus | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);

  // Fetch session status when dialog opens
  useEffect(() => {
    if (open && whatsappNumber && codAgent) {
      const fetchSessionStatus = async () => {
        setSessionLoading(true);
        try {
          const result = await externalDb.getSessionStatus(whatsappNumber, codAgent);
          setSessionData(result);
        } catch (err) {
          console.error('Erro ao buscar status da sessão:', err);
        } finally {
          setSessionLoading(false);
        }
      };
      fetchSessionStatus();
    }
  }, [open, whatsappNumber, codAgent]);

  const handleToggleSession = async () => {
    if (!sessionData) return;
    setUpdatingSession(true);
    try {
      const newStatus = !sessionData.active;
      await externalDb.updateSessionStatus(sessionData.id, newStatus);
      setSessionData({ ...sessionData, active: newStatus });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setUpdatingSession(false);
      setConfirmToggle(false);
    }
  };

  // Format number to JID
  const formatToJid = (number: string): string => {
    const cleaned = number.replace(/\D/g, '');
    return `${cleaned}@s.whatsapp.net`;
  };

  // Load agent credentials from view
  useEffect(() => {
    if (open && codAgent) {
      loadAgentCredentials();
    }
  }, [open, codAgent]);

  // Load messages after credentials are loaded
  useEffect(() => {
    if (open && whatsappNumber && isConfigured) {
      if (provider === 'waba') {
        loadWabaMessages();
      } else if (client) {
        loadMessages();
      }
    }
  }, [open, whatsappNumber, client, isConfigured, provider]);

  // Scroll to bottom only on initial load
  useEffect(() => {
    if (scrollRef.current && isInitialLoad.current && messages.length > 0) {
      setTimeout(() => {
        if (scrollRef.current) {
          const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      }, 100);
      isInitialLoad.current = false;
    }
  }, [messages]);

  // Handle scroll to load more messages
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // If scrolled near top, load more messages
    if (target.scrollTop < 100 && hasMoreMessages && !loadingMore && !loading) {
      loadMoreMessages();
    }
  };

  // Download media from message
  const downloadMedia = async (messageId: string) => {
    if (downloadingMedia.has(messageId)) return;
    
    setDownloadingMedia(prev => new Set(prev).add(messageId));
    
    try {
      if (provider === 'waba') {
        // WABA: use edge function to download via media_id
        const message = messages.find(m => m.id === messageId);
        const mediaId = message?.wabaMediaId;
        if (!mediaId) {
          console.warn('No wabaMediaId for message', messageId);
          return;
        }
        
        console.log('📥 [WABA] Downloading media:', mediaId);
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: { action: 'download_media', cod_agent: codAgent, media_id: mediaId },
        });
        
        if (error) throw error;
        if (data?.base64 && data?.mimetype) {
          const dataUrl = `data:${data.mimetype};base64,${data.base64}`;
          setMediaUrls(prev => ({ ...prev, [messageId]: dataUrl }));
        }
      } else {
        // UaZapi: use client API
        if (!client) return;
        console.log('📥 [UaZapi] Downloading media for message:', messageId);
        const response = await client.post<{ fileURL?: string; base64Data?: string; mimetype?: string }>('/message/download', {
          id: messageId,
          return_link: true,
          return_base64: false,
        });
        
        if (response.fileURL) {
          setMediaUrls(prev => ({ ...prev, [messageId]: response.fileURL! }));
        } else if (response.base64Data && response.mimetype) {
          const dataUrl = `data:${response.mimetype};base64,${response.base64Data}`;
          setMediaUrls(prev => ({ ...prev, [messageId]: dataUrl }));
        }
      }
    } catch (error) {
      console.error('❌ Error downloading media:', error);
      toast({
        title: 'Erro ao baixar mídia',
        description: 'Não foi possível baixar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingMedia(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const loadAgentCredentials = async () => {
    setLoading(true);
    try {
      const result = await externalDb.raw<AgentCredentials>({
        query: `
          SELECT evo_url as api_url, evo_apikey as api_key, evo_instance as api_instance,
                 hub, waba_id, waba_number_id
          FROM agents 
          WHERE cod_agent = $1
          LIMIT 1
        `,
        params: [codAgent],
      });

      if (result && result.length > 0) {
        const creds = result[0];
        const agentHub = creds.hub || 'uazapi';
        
        if (agentHub === 'waba') {
          // WABA provider
          setProvider('waba');
          setClient(null);
          if (creds.waba_id && creds.waba_number_id) {
            setIsConfigured(true);
          } else {
            setIsConfigured(false);
            toast({
              title: 'WABA não configurado',
              description: 'Este agente não possui credenciais WABA completas.',
              variant: 'destructive',
            });
          }
        } else {
          // UaZapi provider
          setProvider('uazapi');
          if (creds.api_url && creds.api_key) {
            const newClient = new UaZapiClient({
              baseUrl: creds.api_url,
              token: creds.api_key,
              instance: creds.api_instance,
            });
            setClient(newClient);
            setIsConfigured(true);
          } else {
            setIsConfigured(false);
            toast({
              title: 'API não configurada',
              description: 'Este agente não possui credenciais UaZapi configuradas.',
              variant: 'destructive',
            });
          }
        }
      } else {
        setIsConfigured(false);
        toast({
          title: 'Agente não encontrado',
          description: 'Não foi possível encontrar as credenciais do agente.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error loading agent credentials:', error);
      setIsConfigured(false);
      toast({
        title: 'Erro ao carregar credenciais',
        description: error.message || 'Não foi possível carregar as credenciais do agente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // WABA: Parse webhook_logs into Message format
  // ============================================

  const mapWabaMessageToDialogMessage = (msg: any, log: any): Message => {
    const msgType = (msg?.type || log?.message_type || 'text') as string;
    let text = '';
    let mediaId: string | undefined;
    let caption: string | undefined;
    let fileName: string | undefined;
    let mimetype: string | undefined;
    let type: MessageType = 'text';

    switch (msgType) {
      case 'text':
        text = msg?.text?.body || log?.message || '';
        type = 'text';
        break;
      case 'image':
        mediaId = msg?.image?.id;
        caption = msg?.image?.caption;
        mimetype = msg?.image?.mime_type;
        text = caption || log?.message || '[Imagem]';
        type = 'image';
        break;
      case 'video':
        mediaId = msg?.video?.id;
        caption = msg?.video?.caption;
        mimetype = msg?.video?.mime_type;
        text = caption || log?.message || '[Vídeo]';
        type = 'video';
        break;
      case 'audio':
        mediaId = msg?.audio?.id;
        mimetype = msg?.audio?.mime_type;
        text = log?.message || '[Áudio]';
        type = 'audio';
        break;
      case 'document':
        mediaId = msg?.document?.id;
        fileName = msg?.document?.filename;
        mimetype = msg?.document?.mime_type;
        caption = msg?.document?.caption;
        text = fileName || caption || log?.message || '[Documento]';
        type = 'document';
        break;
      case 'sticker':
        mediaId = msg?.sticker?.id;
        mimetype = msg?.sticker?.mime_type;
        text = log?.message || '[Sticker]';
        type = 'sticker';
        break;
      case 'location':
        text = msg?.location?.name || log?.message || '[Localização]';
        type = 'location';
        break;
      case 'contacts':
        text = msg?.contacts?.[0]?.name?.formatted_name || log?.message || '[Contato]';
        type = 'contact';
        break;
      case 'interactive':
      case 'button':
      case 'order':
        text = msg?.interactive?.button_reply?.title || msg?.interactive?.list_reply?.title || log?.message || '[Interativo]';
        type = 'text';
        break;
      default:
        text = log?.message || `[${msgType || 'desconhecido'}]`;
        type = 'unknown';
    }

    const timestampRaw = msg?.timestamp || log?.created_at;

    return {
      id: msg?.id || log?.message_id || log?.id,
      text,
      fromMe: false,
      timestamp: normalizeTimestamp(timestampRaw),
      type,
      wabaMediaId: mediaId,
      mimetype,
      caption,
      fileName,
      latitude: msg?.location?.latitude,
      longitude: msg?.location?.longitude,
      ptt: msgType === 'audio' && msg?.audio?.voice === true,
    };
  };

  const parseWabaPayload = (log: any): Message | null => {
    try {
      const payload = log?.payload;
      if (!payload) return null;

      // Formato antigo/completo do webhook (entry/changes)
      const entries = payload?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const msgs = change?.value?.messages || [];
          if (msgs.length > 0) {
            return mapWabaMessageToDialogMessage(msgs[0], log);
          }
        }
      }

      // Formato atual salvo na tabela: payload já é a mensagem da Meta
      if (payload?.id || payload?.type || log?.message_type) {
        return mapWabaMessageToDialogMessage(payload, log);
      }

      return null;
    } catch (e) {
      console.warn('Error parsing WABA payload:', e);
      return null;
    }
  };

  const loadWabaMessages = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    setCurrentOffset(0);
    setHasMoreMessages(true);
    
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      console.log('🔍 [WABA] Loading messages for:', cleanNumber);
      
      const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('from_number', cleanNumber)
        .not('message_type', 'is', null)
        .neq('message_type', 'status')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      if (logs && logs.length > 0) {
        const parsed = logs
          .map(parseWabaPayload)
          .filter((m): m is Message => m !== null);
        
        parsed.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(parsed);
        setCurrentOffset(50);
        setHasMoreMessages(logs.length === 50);
        console.log('✅ [WABA] Processed messages:', parsed.length);
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      console.error('Error loading WABA messages:', error);
      toast({
        title: 'Erro ao carregar mensagens',
        description: error.message || 'Não foi possível carregar as mensagens.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const parseMessages = (messagesArray: any[]): Message[] => {
    return messagesArray.map((msg: any) => {
      const messageContent = msg.message || msg;
      const messageType = detectMessageType(messageContent);
      const mediaData = extractMediaData(messageContent, messageType);
      
      const contextInfo = msg.content?.contextInfo || messageContent.contextInfo || messageContent.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      const quotedText = quotedMessage?.conversation 
        || quotedMessage?.extendedTextMessage?.text
        || quotedMessage?.imageMessage?.caption
        || quotedMessage?.videoMessage?.caption
        || (quotedMessage?.imageMessage ? '[Imagem]' : undefined)
        || (quotedMessage?.audioMessage ? '[Áudio]' : undefined)
        || (quotedMessage?.videoMessage ? '[Vídeo]' : undefined)
        || (quotedMessage?.documentMessage ? '[Documento]' : undefined)
        || (quotedMessage?.stickerMessage ? '[Sticker]' : undefined);
      
      return {
        id: msg.key?.id || msg.id || Math.random().toString(),
        type: messageType,
        text: mediaData.text || '',
        mediaUrl: mediaData.mediaUrl,
        mimetype: mediaData.mimetype,
        caption: mediaData.caption,
        fileName: mediaData.fileName,
        seconds: mediaData.seconds,
        ptt: mediaData.ptt,
        thumbnail: mediaData.thumbnail,
        latitude: mediaData.latitude,
        longitude: mediaData.longitude,
        fromMe: msg.key?.fromMe ?? msg.fromMe ?? false,
        timestamp: normalizeTimestamp(msg.messageTimestamp || msg.timestamp || Date.now()),
        quotedId: msg.quoted || contextInfo?.stanzaId,
        quotedText: quotedText,
        quotedParticipant: contextInfo?.participant,
      };
    });
  };

  const loadMessages = async () => {
    if (!client || !isConfigured) return;

    setLoading(true);
    isInitialLoad.current = true;
    setCurrentOffset(0);
    setHasMoreMessages(true);
    
    try {
      const jid = formatToJid(whatsappNumber);
      const endpoint = '/message/find';
      const requestBody = { chatid: jid, limit: 50, offset: 0 };
      
      console.log('🔍 [WhatsApp API] Loading messages:', { endpoint, requestBody });
      const response = await client.post<any>(endpoint, requestBody);
      const messagesArray = Array.isArray(response) ? response : (response?.messages || []);
      
      console.log('📨 [WhatsApp API] Raw messages:', messagesArray.length);
      
      if (messagesArray.length > 0) {
        const formattedMessages = parseMessages(messagesArray);
        formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(formattedMessages);
        setCurrentOffset(50);
        setHasMoreMessages(messagesArray.length === 50);
        console.log('✅ [WhatsApp API] Processed messages:', formattedMessages.length);
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Erro ao carregar mensagens',
        description: error.message || 'Não foi possível carregar as mensagens.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!isConfigured || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      if (provider === 'waba') {
        // WABA: paginate from webhook_logs
        const cleanNumber = whatsappNumber.replace(/\D/g, '');
        const { data: logs, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .eq('from_number', cleanNumber)
          .not('message_type', 'is', null)
          .neq('message_type', 'status')
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + 49);
        
        if (error) throw error;
        
        if (logs && logs.length > 0) {
          const parsed = logs
            .map(parseWabaPayload)
            .filter((m): m is Message => m !== null);
          
          const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
          const previousScrollHeight = scrollContainer?.scrollHeight || 0;
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = parsed.filter(m => !existingIds.has(m.id));
            const combined = [...newMessages, ...prev];
            combined.sort((a, b) => a.timestamp - b.timestamp);
            return combined;
          });
          
          setTimeout(() => {
            if (scrollContainer) {
              const newScrollHeight = scrollContainer.scrollHeight;
              scrollContainer.scrollTop = newScrollHeight - previousScrollHeight;
            }
          }, 50);
          
          setCurrentOffset(prev => prev + 50);
          setHasMoreMessages(logs.length === 50);
        } else {
          setHasMoreMessages(false);
        }
      } else {
        // UaZapi
        if (!client) return;
        const jid = formatToJid(whatsappNumber);
        const requestBody = { chatid: jid, limit: 50, offset: currentOffset };
        
        const response = await client.post<any>('/message/find', requestBody);
        const messagesArray = Array.isArray(response) ? response : (response?.messages || []);
        
        if (messagesArray.length > 0) {
          const formattedMessages = parseMessages(messagesArray);
          
          const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
          const previousScrollHeight = scrollContainer?.scrollHeight || 0;
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = formattedMessages.filter(m => !existingIds.has(m.id));
            const combined = [...newMessages, ...prev];
            combined.sort((a, b) => a.timestamp - b.timestamp);
            return combined;
          });
          
          setTimeout(() => {
            if (scrollContainer) {
              const newScrollHeight = scrollContainer.scrollHeight;
              scrollContainer.scrollTop = newScrollHeight - previousScrollHeight;
            }
          }, 50);
          
          setCurrentOffset(prev => prev + 50);
          setHasMoreMessages(messagesArray.length === 50);
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error: any) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      if (provider === 'waba') {
        // WABA: send via edge function
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_text',
            cod_agent: codAgent,
            to: whatsappNumber,
            text: newMessage.trim(),
          },
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error.message || data.error);
      } else {
        // UaZapi
        if (!client) return;
        await client.post('/send/text', {
          number: whatsappNumber.replace(/\D/g, ''),
          text: newMessage.trim(),
        });
      }

      // Add message to local state
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          text: newMessage.trim(),
          fromMe: true,
          timestamp: Date.now(),
          type: 'text',
        },
      ]);
      
      setNewMessage('');
      
      toast({
        title: 'Mensagem enviada',
        description: 'A mensagem foi enviada com sucesso.',
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDateShortSaoPaulo(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 bg-card" aria-describedby={undefined}>
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-green-600">
              <AvatarFallback className="bg-green-600 text-white">
                <MessageCircle className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold truncate">
                {leadName || whatsappNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground sr-only">
                Conversa do WhatsApp com {leadName || whatsappNumber}
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                {whatsappNumber}
              </p>
            </div>
            {/* Julia Status Inline */}
            <div className="flex items-center gap-1.5 mr-6">
              <button
                type="button"
                onClick={() => setStatusDialogOpen(true)}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                title="Ver status do atendimento"
              >
                <Bot className={cn(
                  "h-5 w-5",
                  sessionLoading ? "text-muted-foreground animate-pulse" :
                  sessionData?.active === true ? "text-green-500" :
                  sessionData?.active === false ? "text-red-500" :
                  "text-muted-foreground"
                )} />
              </button>
              <Switch
                checked={sessionData?.active ?? false}
                onCheckedChange={() => setConfirmToggle(true)}
                disabled={!sessionData || updatingSession || sessionLoading}
                className="scale-75"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Alert Dialog for Julia toggle confirmation */}
        <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {sessionData?.active ? 'Desativar atendimento?' : 'Ativar atendimento?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {sessionData?.active
                  ? 'Ao desativar, o agente não responderá mais este contato até que seja ativado novamente.'
                  : 'Ao ativar, o agente voltará a responder este contato.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingSession}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleToggleSession} disabled={updatingSession}>
                {updatingSession && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {sessionData?.active ? 'Desativar' : 'Ativar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef} onScrollCapture={handleScroll}>
          {loading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center space-y-2">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Loading more indicator */}
              {loadingMore && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMoreMessages && messages.length >= 50 && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-xs text-muted-foreground">Início da conversa</span>
                </div>
              )}
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date} className="space-y-2">
                  {/* Date separator */}
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] bg-secondary/50 px-2.5 py-1 rounded-full text-muted-foreground font-medium">
                      {date}
                    </span>
                  </div>
                  
                  {/* Messages for this date */}
                  {dateMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.fromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 shadow-sm",
                          message.fromMe
                            ? "bg-green-100 dark:bg-green-900/40 text-foreground rounded-br-none"
                            : "bg-card border border-border/50 rounded-bl-none"
                        )}
                      >
                        <MessageBubble 
                          message={message}
                          onDownload={downloadMedia}
                          isDownloading={downloadingMedia.has(message.id)}
                          downloadedUrl={mediaUrls[message.id]}
                        />
                        <p
                          className={cn(
                            "text-[10px] mt-1 text-right text-muted-foreground"
                          )}
                        >
                          {formatTimeSaoPaulo(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite uma mensagem..."
              disabled={!isConfigured || sending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !isConfigured || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <SessionStatusDialog
      open={statusDialogOpen}
      onOpenChange={(open) => {
        setStatusDialogOpen(open);
        if (!open && whatsappNumber && codAgent) {
          externalDb.getSessionStatus(whatsappNumber, codAgent)
            .then(result => setSessionData(result))
            .catch(console.error);
        }
      }}
      whatsappNumber={whatsappNumber}
      codAgent={codAgent}
    />
    </>
  );
}
