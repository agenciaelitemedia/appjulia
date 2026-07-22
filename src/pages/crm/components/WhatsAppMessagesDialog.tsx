import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Send, Loader2, 
  Mic, FileText, Download, MapPin, User, Image as ImageIcon, Video, Play, Bot,
  Zap, Paperclip, StickyNote, Search, Square, X, Scale, Pencil, Check,
  Eye, Phone, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { externalDb } from '@/lib/externalDb';
import { toggleJuliaSession } from '@/lib/juliaSessionControl';
import { useAuth } from '@/contexts/AuthContext';
import { SessionStatusDialog } from './SessionStatusDialog';
import { UaZapiClient } from '@/lib/uazapi';
import { supabase } from '@/integrations/supabase/client';
import { formatTimeSaoPaulo, formatDateShortSaoPaulo } from '@/lib/dateUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuickMessages } from '@/hooks/useQuickMessages';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useContractInfo } from '../hooks/useContractInfo';
import { useCRMCardByWhatsapp, useCRMStages, useUpdateCardName } from '../hooks/useCRMData';
import { ContractInfoContent } from './ContractInfoContent';
import { CRMLeadDetailsDialog } from './CRMLeadDetailsDialog';
import { PhoneCallDialog } from './PhoneCallDialog';
import { useAgentQueueLink } from '@/hooks/useAgentQueueLink';


// ============================================
// Types
// ============================================

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'internal_note' | 'unknown';

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
  // Internal note fields
  authorName?: string;
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
  /** 'dialog' (popup, default), 'sheet' (right sidebar panel), or 'inline' (no wrapper) */
  variant?: 'dialog' | 'sheet' | 'inline';
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
  variant = 'dialog',
}: WhatsAppMessagesDialogProps) {
  
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
  const [agentInstance, setAgentInstance] = useState<string | null>(null);
  // When source='queue' we read messages from chat_messages (DB) instead of UaZapi /message/find or webhook_logs
  const [dbContactId, setDbContactId] = useState<string | null>(null);
  
  // Media download state
  const [downloadingMedia, setDownloadingMedia] = useState<Set<string>>(new Set());
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
   
  // Session status inline state
  const [sessionData, setSessionData] = useState<import('@/lib/externalDb').SessionStatus | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const navigate = useNavigate();
  const [quickMsgSearch, setQuickMsgSearch] = useState('');
  const [quickMsgOpen, setQuickMsgOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Internal notes state
  const { user: authUser } = useAuth();
  const [noteMode, setNoteMode] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(true);

   // Contract sidebar state
  const [contractSidebarOpen, setContractSidebarOpen] = useState(false);
  const { data: contractInfo, isLoading: contractLoading } = useContractInfo(whatsappNumber, codAgent, open);

  // Connection origin: queue (azul) vs direct UaZapi (verde)
  const { data: agentLink, isLoading: agentLinkLoading } = useAgentQueueLink(codAgent, open);
  const isViaQueue = agentLink?.source === 'queue';
  const useDbSource = isViaQueue; // queue vinculada → ler/escutar chat_messages
  const avatarBg = isViaQueue ? 'bg-blue-600' : 'bg-green-600';
  const sourceLabel = isViaQueue
    ? agentLink?.queueName
    : (agentInstance || (provider === 'waba' ? 'WABA' : 'UaZapi'));

  // Editable name state
  const { data: crmCard } = useCRMCardByWhatsapp(open ? whatsappNumber : null);
  const { data: stages = [] } = useCRMStages();
  const updateCardName = useUpdateCardName();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(leadName || '');
  const [displayName, setDisplayName] = useState(leadName || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    setDisplayName(leadName || '');
    setEditName(leadName || '');
  }, [leadName]);

  const handleSaveName = async () => {
    if (!crmCard?.id || !editName.trim()) return;
    try {
      await updateCardName.mutateAsync({ cardId: crmCard.id, contactName: editName.trim() });
      setDisplayName(editName.trim());
      setIsEditingName(false);
      toast.success('Nome atualizado');
    } catch {
      toast.error('Erro ao atualizar nome');
    }
  };

  const handleCancelEditName = () => {
    setEditName(displayName);
    setIsEditingName(false);
  };

  // Quick messages
  const { messages: quickMessages } = useQuickMessages('chat_popup');
  const filteredQuickMessages = quickMessages.filter(qm =>
    qm.title.toLowerCase().includes(quickMsgSearch.toLowerCase()) ||
    qm.message_text.toLowerCase().includes(quickMsgSearch.toLowerCase()) ||
    (qm.shortcut && qm.shortcut.toLowerCase().includes(quickMsgSearch.toLowerCase()))
  );
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
      await toggleJuliaSession({
        sessionId: sessionData.id,
        active: newStatus,
        codAgent,
        whatsappNumber,
        hubFila: (agentQueueLink as any)?.hub,
      });
      setSessionData({ ...sessionData, active: newStatus });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setUpdatingSession(false);
      setConfirmToggle(false);
    }
  };

  // ============================================
  // Audio Recording
  // ============================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
          ? 'audio/ogg; codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingTime(0);

        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 500) return; // too short

        await sendAudioBlob(blob, mediaRecorder.mimeType);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const sendAudioBlob = async (blob: Blob, mimeType: string) => {
    setSendingAudio(true);
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';

      if (useDbSource && agentLink?.queueId) {
        // Linked-queue: route audio through the queue pipeline (UaZapi/WABA + chat_messages).
        const audioFile = new File([blob], `audio.${ext}`, { type: mimeType });
        await sendViaQueue({ kind: 'media', file: audioFile, mediaType: 'audio', isPtt: true });
        toast.success('Áudio enviado');
        return;
      }

      if (provider === 'waba') {
        // Meta WABA não aceita audio/webm. Como o codec gravado é opus,
        // re-rotulamos como audio/ogg (container compatível com opus aceito pela Meta).
        const wabaMime = 'audio/ogg';
        const wabaExt = 'ogg';
        const { error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_media',
            cod_agent: codAgent,
            to: cleanNumber,
            media_type: 'audio',
            base64,
            mimetype: wabaMime,
            filename: `audio.${wabaExt}`,
          },
        });
        if (error) throw error;
      } else {
        if (!client) throw new Error('Client not configured');
        await client.post('/send/media', {
          number: cleanNumber,
          file: `data:${mimeType};base64,${base64}`,
          type: 'audio',
          fileName: `audio.${ext}`,
          caption: '',
        });
      }

      // Add to local state
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `[Áudio ${formatDuration(recordingTime)}]`,
          fromMe: true,
          timestamp: Date.now(),
          type: 'audio',
          ptt: true,
          mimetype: mimeType,
          mediaUrl: URL.createObjectURL(blob),
        },
      ]);

      toast.success('Áudio enviado');
    } catch (err: any) {
      console.error('Error sending audio:', err);
      toast.error('Erro ao enviar áudio');
    } finally {
      setSendingAudio(false);
    }
  };

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Load internal notes and merge into messages
  const loadAndMergeNotes = useCallback(async () => {
    try {
      const { data: notes, error } = await supabase
        .from('crm_internal_notes')
        .select('*')
        .eq('whatsapp_number', whatsappNumber.replace(/\D/g, ''))
        .eq('cod_agent', codAgent)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      if (!notes || notes.length === 0) return;
      
      const noteMessages: Message[] = notes.map((n: any) => ({
        id: `note-${n.id}`,
        text: n.note_text,
        fromMe: true,
        timestamp: new Date(n.created_at).getTime(),
        type: 'internal_note' as MessageType,
        authorName: n.author_name,
      }));
      
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newNotes = noteMessages.filter(n => !existingIds.has(n.id));
        if (newNotes.length === 0) return prev;
        const combined = [...prev, ...newNotes];
        combined.sort((a, b) => a.timestamp - b.timestamp);
        return combined;
      });
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  }, [whatsappNumber, codAgent]);

  // Send internal note
  const handleSendNote = async () => {
    if (!newMessage.trim() || sendingNote) return;
    
    setSendingNote(true);
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      const authorName = authUser?.name || 'Usuário';
      
      const { data, error } = await supabase
        .from('crm_internal_notes')
        .insert({
          whatsapp_number: cleanNumber,
          cod_agent: codAgent,
          note_text: newMessage.trim(),
          author_name: authorName,
          author_id: authUser?.id?.toString() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      setMessages(prev => [
        ...prev,
        {
          id: `note-${data.id}`,
          text: newMessage.trim(),
          fromMe: true,
          timestamp: new Date(data.created_at).getTime(),
          type: 'internal_note',
          authorName,
        },
      ]);
      
      setNewMessage('');
      setNoteMode(false);
      toast.success('Nota adicionada: A nota interna foi salva com sucesso.');
    } catch (err: any) {
      console.error('Error saving note:', err);
      toast.error('Erro ao salvar nota');
    } finally {
      setSendingNote(false);
    }
  };

  // Format number to JID
  const formatToJid = (number: string): string => {
    const cleaned = number.replace(/\D/g, '');
    return `${cleaned}@s.whatsapp.net`;
  };

  // Load credentials (from queue when linked, otherwise from agent).
  // Wait for the queue-link query to settle so we don't briefly use
  // the wrong source when both could resolve.
  useEffect(() => {
    if (open && codAgent && !agentLinkLoading) {
      loadAgentCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, codAgent, agentLinkLoading, agentLink?.source, agentLink?.queueId]);

  // Load messages after credentials are loaded
  useEffect(() => {
    if (open && whatsappNumber && isConfigured) {
      if (useDbSource) {
        loadDbMessages().then(() => loadAndMergeNotes());
      } else if (provider === 'waba') {
        loadWabaMessages().then(() => loadAndMergeNotes());
      } else if (client) {
        loadMessages().then(() => loadAndMergeNotes());
      }
    }
  }, [open, whatsappNumber, client, isConfigured, provider, useDbSource]);

  // Realtime subscription on chat_messages — only when in queue (DB) mode
  useEffect(() => {
    if (!open || !useDbSource || !dbContactId) return;
    const channel = supabase
      .channel(`crm-popup-msgs-${dbContactId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `contact_id=eq.${dbContactId}` },
        (payload) => {
          const row: any = payload.new;
          const incoming = mapDbRowToMessage(row);
          setMessages(prev => {
            if (prev.some(m => m.id === incoming.id)) return prev;
            const combined = [...prev, incoming];
            combined.sort((a, b) => a.timestamp - b.timestamp);
            return combined;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `contact_id=eq.${dbContactId}` },
        (payload) => {
          const row: any = payload.new;
          const updated = mapDbRowToMessage(row);
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, useDbSource, dbContactId]);

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
      toast.error('Erro ao baixar mídia: Não foi possível baixar o arquivo.');
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
      // ─────────────────────────────────────────────────────────
      // 1) Queue-routed: use the QUEUE's credentials (not the agent's).
      //    Ensures /message/find, /send/text and /message/download
      //    hit the same UaZapi/WABA instance the queue sends from.
      // ─────────────────────────────────────────────────────────
      if (agentLink?.source === 'queue') {
        const qHub = (agentLink.hub || 'uazapi').toLowerCase();
        setAgentInstance(agentLink.evoInstance || null);

        if (qHub === 'waba') {
          setProvider('waba');
          setClient(null);
          if (agentLink.wabaId && agentLink.wabaNumberId) {
            setIsConfigured(true);
          } else {
            setIsConfigured(false);
            toast.error('Fila WABA incompleta: a fila vinculada não possui waba_id/waba_number_id.');
          }
        } else {
          setProvider('uazapi');
          if (agentLink.evoUrl && agentLink.evoApikey) {
            const newClient = new UaZapiClient({
              baseUrl: agentLink.evoUrl,
              token: agentLink.evoApikey,
              instance: agentLink.evoInstance || undefined,
            });
            setClient(newClient);
            setIsConfigured(true);
          } else {
            setIsConfigured(false);
            toast.error('Fila UaZapi incompleta: a fila vinculada não possui URL/Token configurados.');
          }
        }
        return;
      }

      // ─────────────────────────────────────────────────────────
      // 2) Direct: fall back to the agent's own credentials.
      // ─────────────────────────────────────────────────────────
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
        setAgentInstance(creds.api_instance || null);

        if (agentHub === 'waba') {
          // WABA provider
          setProvider('waba');
          setClient(null);
          if (creds.waba_id && creds.waba_number_id) {
            setIsConfigured(true);
          } else {
            setIsConfigured(false);
            toast.error('WABA não configurado: Este agente não possui credenciais WABA completas.');
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
            toast.error('API não configurada: Este agente não possui credenciais UaZapi configuradas.');
          }
        }
      } else {
        setIsConfigured(false);
        toast.error('Agente não encontrado: Não foi possível encontrar as credenciais do agente.');
      }
    } catch (error: any) {
      console.error('Error loading agent credentials:', error);
      setIsConfigured(false);
      toast.error('Erro ao carregar credenciais');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // WABA: Parse webhook_logs into Message format
  // ============================================
  
  const parseWabaPayload = (log: any): Message | null => {
    try {
      const payload = log.payload;
      if (!payload) return null;
      
      // Messages received from contacts (incoming)
      const entries = payload?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;
          
          const msgs = value.messages || [];
          for (const msg of msgs) {
            const msgType = msg.type as string;
            let text = '';
            let mediaId: string | undefined;
            let caption: string | undefined;
            let fileName: string | undefined;
            let mimetype: string | undefined;
            let type: MessageType = 'text';
            
            switch (msgType) {
              case 'text':
                text = msg.text?.body || '';
                type = 'text';
                break;
              case 'image':
                mediaId = msg.image?.id;
                caption = msg.image?.caption;
                mimetype = msg.image?.mime_type;
                text = caption || '[Imagem]';
                type = 'image';
                break;
              case 'video':
                mediaId = msg.video?.id;
                caption = msg.video?.caption;
                mimetype = msg.video?.mime_type;
                text = caption || '[Vídeo]';
                type = 'video';
                break;
              case 'audio':
                mediaId = msg.audio?.id;
                mimetype = msg.audio?.mime_type;
                text = '[Áudio]';
                type = 'audio';
                break;
              case 'document':
                mediaId = msg.document?.id;
                fileName = msg.document?.filename;
                mimetype = msg.document?.mime_type;
                caption = msg.document?.caption;
                text = fileName || '[Documento]';
                type = 'document';
                break;
              case 'sticker':
                mediaId = msg.sticker?.id;
                mimetype = msg.sticker?.mime_type;
                text = '[Sticker]';
                type = 'sticker';
                break;
              case 'location':
                text = msg.location?.name || '[Localização]';
                type = 'location';
                break;
              case 'contacts':
                text = msg.contacts?.[0]?.name?.formatted_name || '[Contato]';
                type = 'contact';
                break;
              default:
                text = `[${msgType || 'desconhecido'}]`;
                type = 'unknown';
            }
            
            return {
              id: msg.id || log.id,
              text,
              fromMe: false,
              timestamp: msg.timestamp ? parseInt(msg.timestamp) * 1000 : new Date(log.created_at).getTime(),
              type,
              wabaMediaId: mediaId,
              mimetype,
              caption,
              fileName,
              latitude: msg.location?.latitude,
              longitude: msg.location?.longitude,
              ptt: msgType === 'audio' && msg.audio?.voice === true,
            };
          }
        }
      }
      
      return null;
    } catch (e) {
      console.warn('Error parsing WABA payload:', e);
      return null;
    }
  };

  // ─────────────────────────────────────────────
  // Map a chat_messages row → local Message
  // ─────────────────────────────────────────────
  const mapDbRowToMessage = (m: any): Message => {
    const meta = (m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata))
      ? m.metadata
      : {};
    const rawType = (m.type || 'text') as string;
    const isPtt = rawType === 'ptt' || meta.is_ptt === true;
    const mappedType: MessageType = (() => {
      if (rawType === 'ptt') return 'audio';
      if (rawType === 'reaction' || rawType === 'revoked') return 'unknown';
      if ((['text','image','audio','video','document','sticker','location','contact'] as const).includes(rawType as any)) {
        return rawType as MessageType;
      }
      return 'unknown';
    })();
    const isInternalNote = m.internal_note === true || meta.internal_note === true;
    const tsRaw = m.timestamp || m.created_at;
    const tsMs = tsRaw ? new Date(tsRaw).getTime() : Date.now();
    return {
      id: m.id,
      text: m.text || meta.location_name || '',
      fromMe: !!m.from_me,
      timestamp: tsMs,
      type: isInternalNote ? 'internal_note' : mappedType,
      mediaUrl: m.media_url || undefined,
      mimetype: meta.mimetype || undefined,
      caption: m.caption || undefined,
      fileName: m.file_name || undefined,
      seconds: meta.duration || undefined,
      ptt: isPtt || undefined,
      thumbnail: meta.thumbnail || undefined,
      latitude: meta.latitude || undefined,
      longitude: meta.longitude || undefined,
      quotedId: meta.quoted_message?.id,
      quotedText: meta.quoted_message?.text,
      quotedParticipant: meta.quoted_message?.sender_name,
      authorName: m.sender_name || meta.sender_name || undefined,
    };
  };

  // ─────────────────────────────────────────────
  // Load messages from chat_messages (queue mode)
  // Uses chat_contacts (client_id + phone) to resolve contact_id
  // ─────────────────────────────────────────────
  const loadDbMessages = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    setCurrentOffset(0);
    setHasMoreMessages(true);

    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      const clientId = authUser?.client_id?.toString();
      if (!clientId) {
        setMessages([]);
        setHasMoreMessages(false);
        return;
      }

      // Resolve contact_id (try matches by phone for this client)
      const { data: contactRows, error: contactErr } = await supabase
        .from('chat_contacts')
        .select('id, phone')
        .eq('client_id', clientId)
        .or(`phone.eq.${cleanNumber},phone.eq.+${cleanNumber}`)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (contactErr) throw contactErr;

      // Fallback: also try last-4-digits match if no exact hit (handles 55/9 prefixes)
      let contact = contactRows?.[0];
      if (!contact && cleanNumber.length >= 8) {
        const tail = cleanNumber.slice(-8);
        const { data: fuzzy } = await supabase
          .from('chat_contacts')
          .select('id, phone')
          .eq('client_id', clientId)
          .like('phone', `%${tail}`)
          .order('updated_at', { ascending: false })
          .limit(1);
        contact = fuzzy?.[0];
      }

      if (!contact) {
        setDbContactId(null);
        setMessages([]);
        setHasMoreMessages(false);
        return;
      }

      setDbContactId(contact.id);

      const { data: msgs, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('contact_id', contact.id)
        .order('timestamp', { ascending: false })
        .range(0, 49);

      if (error) throw error;

      if (msgs && msgs.length > 0) {
        const parsed = msgs.map(mapDbRowToMessage);
        parsed.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(parsed);
        setCurrentOffset(50);
        setHasMoreMessages(msgs.length === 50);
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      console.error('[CRM popup] Error loading DB messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const loadWabaMessages = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    setCurrentOffset(0);
    setHasMoreMessages(true);
    
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
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
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      console.error('Error loading WABA messages:', error);
      toast.error('Erro ao carregar mensagens');
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
      
      const response = await client.post<any>(endpoint, requestBody);
      const messagesArray = Array.isArray(response) ? response : (response?.messages || []);

      if (messagesArray.length > 0) {
        const formattedMessages = parseMessages(messagesArray);
        formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(formattedMessages);
        setCurrentOffset(50);
        setHasMoreMessages(messagesArray.length === 50);
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!isConfigured || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      if (useDbSource) {
        // DB source (queue mode) — paginate chat_messages
        if (!dbContactId) {
          setHasMoreMessages(false);
          return;
        }
        const { data: msgs, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('contact_id', dbContactId)
          .order('timestamp', { ascending: false })
          .range(currentOffset, currentOffset + 49);
        if (error) throw error;

        if (msgs && msgs.length > 0) {
          const parsed = msgs.map(mapDbRowToMessage);
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
          setHasMoreMessages(msgs.length === 50);
        } else {
          setHasMoreMessages(false);
        }
      } else if (provider === 'waba') {
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

  // ─────────────────────────────────────────────────────────────
  // Linked-queue send pipeline (mirrors /chat behavior).
  // - Routes through queue credentials (UaZapi proxy or WABA edge).
  // - Persists into chat_messages → Realtime subscription updates UI.
  // - For media: uploads to chat-media bucket for previews.
  // ─────────────────────────────────────────────────────────────
  type QueueSendInput =
    | { kind: 'text'; text: string }
    | { kind: 'media'; file: File; mediaType: 'image' | 'video' | 'audio' | 'document'; caption?: string; isPtt?: boolean };

  const sendViaQueue = async (input: QueueSendInput) => {
    if (!agentLink || agentLink.source !== 'queue' || !agentLink.queueId) {
      throw new Error('Fila vinculada indisponível');
    }
    const clientIdStr = authUser?.client_id?.toString();
    if (!clientIdStr) throw new Error('Client ID indisponível');
    if (!dbContactId) throw new Error('Contato (chat_contacts) não resolvido');

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const isWaba = agentLink.channelType === 'waba';

    // Resolve an existing open/pending conversation for persistence (best-effort).
    let conversationId: string | null = null;
    try {
      const { data: existingConv } = await supabase
        .from('chat_conversations')
        .select('id, queue_id, queues:queue_id(is_deleted)')
        .eq('contact_id', dbContactId)
        .eq('client_id', clientIdStr)
        .in('status', ['pending', 'open'])
        .order('created_at', { ascending: false })
        .limit(5);
      // Skip conversations whose queue was soft-deleted
      const usable = (existingConv as any[] | null)?.find((r) => !r?.queues || r.queues.is_deleted !== true) || null;
      conversationId = usable?.id ?? null;
    } catch {
      conversationId = null;
    }

    let externalMessageId: string | undefined;
    let persistedUrl: string | null = null;
    let insertText: string | null = null;
    let insertType: string = 'text';
    let insertFileName: string | null = null;
    let insertCaption: string | null = null;

    if (input.kind === 'text') {
      insertText = input.text;
      insertType = 'text';

      if (isWaba) {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: { action: 'send_text', queue_id: agentLink.queueId, to: cleanNumber, text: input.text },
        });
        if (error) throw error;
        if (data?.error) {
          const m = data.error?.error_user_msg || data.error?.message || JSON.stringify(data.error);
          throw new Error(typeof m === 'string' ? m : 'WABA send failed');
        }
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else {
        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/send/text',
            token: agentLink.evoApikey,
            baseUrl: agentLink.evoUrl,
            body: { number: cleanNumber, text: input.text },
          },
        });
        if (error) throw error;
        if (!data?.ok) {
          const upstream = data?.data;
          const m = upstream?.message || upstream?.error || `UaZapi status ${data?.status}`;
          throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
        }
        const proxyData = data?.data || {};
        externalMessageId = proxyData?.key?.id || proxyData?.id || proxyData?.messageId;
      }
    } else {
      const { file, mediaType, caption, isPtt } = input;
      insertText = caption ?? null;
      insertType = mediaType;
      insertFileName = file.name;
      insertCaption = caption ?? null;

      const isAudio = mediaType === 'audio';
      // For WABA audio recorded as webm, relabel container as ogg (codec is opus).
      const sendMime = isWaba && isAudio && (file.type || '').toLowerCase().includes('webm') ? 'audio/ogg' : (file.type || 'application/octet-stream');
      const sendName = isWaba && isAudio && (file.type || '').toLowerCase().includes('webm')
        ? file.name.replace(/\.[^.]+$/u, '') + '.ogg'
        : file.name;

      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      // Upload for storage/preview (tolerant of failures).
      try {
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('chat-media-upload', {
          body: {
            base64,
            mimetype: sendMime,
            fileName: sendName,
            contactId: dbContactId,
            clientId: clientIdStr,
            source: 'outgoing',
          },
        });
        if (!uploadError && uploadData?.url) persistedUrl = uploadData.url;
      } catch (e) {
        console.warn('[CRM popup] chat-media-upload failed (continuing):', e);
      }

      if (isWaba) {
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_media',
            queue_id: agentLink.queueId,
            to: cleanNumber,
            mediaBase64: base64,
            mimetype: sendMime,
            type: mediaType,
            caption,
            fileName: sendName,
          },
        });
        if (error) throw error;
        if (data?.error) {
          const m = data.error?.error_user_msg || data.error?.message || JSON.stringify(data.error);
          throw new Error(typeof m === 'string' ? m : 'WABA media send failed');
        }
        externalMessageId = data?.messageId || data?.messages?.[0]?.id;
      } else {
        const fileField = isAudio
          ? `data:${file.type || 'audio/webm;codecs=opus'};base64,${base64}`
          : (persistedUrl || `data:${file.type};base64,${base64}`);
        const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            method: 'POST',
            endpoint: '/send/media',
            token: agentLink.evoApikey,
            baseUrl: agentLink.evoUrl,
            body: {
              number: cleanNumber,
              file: fileField,
              mediaUrl: persistedUrl || undefined,
              type: mediaType,
              mediaType,
              mimetype: file.type || undefined,
              caption,
              fileName: file.name,
              docName: mediaType === 'document' ? file.name : undefined,
              ptt: isPtt ? true : undefined,
            },
          },
        });
        if (error) throw error;
        if (!data?.ok) {
          const upstream = data?.data;
          const m = upstream?.message || upstream?.error || `UaZapi status ${data?.status}`;
          throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
        }
        const proxyData = data?.data || {};
        externalMessageId = proxyData?.key?.id || proxyData?.id || proxyData?.messageId;
      }
    }

    // Persist to chat_messages — Realtime subscription will render it in this popup.
    const nowIso = new Date().toISOString();
    try {
      await supabase.from('chat_messages').insert({
        contact_id: dbContactId,
        client_id: clientIdStr,
        text: insertText,
        type: insertType,
        from_me: true,
        status: 'sent',
        message_id: externalMessageId,
        external_id: externalMessageId,
        media_url: persistedUrl,
        file_name: insertFileName,
        caption: insertCaption,
        timestamp: nowIso,
        created_at: nowIso,
        conversation_id: conversationId,
        sender_name: authUser?.name,
        channel_type: isWaba ? 'whatsapp_waba' : 'whatsapp_uazapi',
      });
    } catch (e) {
      console.warn('[CRM popup] Failed to persist outgoing message in chat_messages:', e);
    }

    // Update last_message on chat_contacts (best-effort).
    try {
      await supabase
        .from('chat_contacts')
        .update({ last_message_at: nowIso, last_message_text: insertText || `[${insertType}]` })
        .eq('id', dbContactId);
    } catch {
      /* noop */
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      // Build message with sender signature (if enabled)
      const senderName = authUser?.name || 'Usuário';
      const messageWithSignature = signatureEnabled
        ? `*${senderName}:*\n${newMessage.trim()}`
        : newMessage.trim();

      if (useDbSource && agentLink?.queueId) {
        // ───────────────────────────────────────────────
        // Linked-queue mode: replicate /chat send logic.
        // Uses queue credentials (UaZapi proxy or WABA edge)
        // and persists into chat_messages so Realtime updates UI.
        // ───────────────────────────────────────────────
        await sendViaQueue({ kind: 'text', text: messageWithSignature });
        setNewMessage('');
      } else if (provider === 'waba') {
        // WABA: send via edge function
        const { data, error } = await supabase.functions.invoke('waba-send', {
          body: {
            action: 'send_text',
            cod_agent: codAgent,
            to: whatsappNumber,
            text: messageWithSignature,
          },
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error.message || data.error);

        // Local UI add (non-DB mode)
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: messageWithSignature, fromMe: true, timestamp: Date.now(), type: 'text' },
        ]);
        setNewMessage('');
      } else {
        // UaZapi
        if (!client) return;
        await client.post('/send/text', {
          number: whatsappNumber.replace(/\D/g, ''),
          text: messageWithSignature,
        });
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: messageWithSignature, fromMe: true, timestamp: Date.now(), type: 'text' },
        ]);
        setNewMessage('');
      }

      // Update stage_entered_at on CRM card
      try {
        const cleanNum = whatsappNumber.replace(/\D/g, '');
        await externalDb.raw({
          query: `UPDATE crm_atendimento_cards SET stage_entered_at = NOW(), updated_at = NOW() WHERE whatsapp_number = $1 AND cod_agent = $2`,
          params: [cleanNum, codAgent],
        });
      } catch (e) {
        console.warn('[CRM] Failed to update stage_entered_at:', e);
      }
      
      toast.success('Mensagem enviada: A mensagem foi enviada com sucesso.');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const isSheet = variant === 'sheet';
  const isInline = variant === 'inline';

  const Wrapper = isSheet ? Sheet : Dialog;
  const Content = isSheet ? SheetContent : DialogContent;
  const Header = isInline ? 'div' : (isSheet ? SheetHeader : DialogHeader);
  const Title = isInline ? 'h2' : (isSheet ? SheetTitle : DialogTitle);
  const Description = isInline ? 'p' : (isSheet ? SheetDescription : DialogDescription);

  const sheetWidth = contractSidebarOpen
    ? 'w-[calc(100vw-1rem)] sm:w-[1140px] sm:!max-w-[1140px]'
    : 'w-[calc(100vw-1rem)] sm:w-[640px] sm:!max-w-[640px]';
  const contentProps = isSheet
    ? { side: 'right' as const, className: `${sheetWidth} !gap-0 overflow-hidden p-0 flex flex-row h-full transition-all duration-300` }
    : { className: 'sm:max-w-[500px] h-[600px] flex flex-col p-0 bg-card' };

  // --- Inline content (contract sidebar + chat column) ---
  const renderInnerContent = () => (
    <>
        {/* Contract Details Panel - inline side by side (LEFT of chat) */}
        {contractSidebarOpen && (
          <div className="w-[480px] min-w-0 border-r flex flex-col h-full bg-background">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Scale className="h-5 w-5" />
                Detalhes do Contrato
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContractSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <ContractInfoContent contractInfo={contractInfo} isLoading={contractLoading} contactName={displayName} />
            </div>
          </div>
        )}
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <Header className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className={cn('h-10 w-10', avatarBg)}>
              <AvatarFallback className={cn(avatarBg, 'text-white')}>
                <MessageCircle className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    ref={nameInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEditName();
                    }}
                    className="h-7 text-sm font-semibold"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveName} disabled={updateCardName.isPending}>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEditName}>
                    <X className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ) : (
                <Title className="text-base font-semibold truncate group cursor-pointer flex items-center gap-1" onClick={() => { setEditName(displayName); setIsEditingName(true); }}>
                  {displayName || whatsappNumber}
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </Title>
              )}
              <Description className="text-xs text-muted-foreground sr-only">
                Conversa do WhatsApp com {displayName || whatsappNumber}
              </Description>
              <p className="text-xs text-muted-foreground">
                {whatsappNumber}
              </p>
              {sourceLabel && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'mt-0.5 text-[10px] px-1.5 py-0 h-4 font-medium text-white border-0',
                    isViaQueue
                      ? 'bg-blue-600 hover:bg-blue-600'
                      : 'bg-green-600 hover:bg-green-600'
                  )}
                  title={isViaQueue ? 'Conexão via Fila vinculada' : 'Conexão UaZapi direta'}
                >
                  {isViaQueue ? '📥 ' : '🔗 '}{sourceLabel}
                </Badge>
              )}
            </div>
            {/* Contract icon + Julia Status Inline */}
            <div className="flex items-center gap-1.5 mr-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => contractInfo && setContractSidebarOpen(prev => !prev)}
                    className={cn(
                      "hover:opacity-80 transition-opacity p-1 rounded",
                      contractInfo ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                    )}
                    disabled={!contractInfo}
                  >
                    <Scale className={cn("h-5 w-5", contractInfo ? "text-primary" : "text-muted-foreground")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {contractInfo ? 'Ver detalhes do contrato' : 'Sem contrato'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => crmCard && setDetailsOpen(true)}
                    className={cn(
                      "hover:opacity-80 transition-opacity p-1 rounded",
                      crmCard ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                    )}
                    disabled={!crmCard}
                  >
                    <Eye className={cn("h-5 w-5", crmCard ? "text-foreground" : "text-muted-foreground")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Detalhes do card CRM</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPhoneCallOpen(true)}
                    className="hover:opacity-80 transition-opacity p-1 rounded cursor-pointer"
                  >
                    <Phone className="h-5 w-5 text-orange-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Ligar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/leads?whatsapp=${encodeURIComponent(whatsappNumber)}`)}
                    className="hover:opacity-80 transition-opacity p-1 rounded cursor-pointer"
                  >
                    <ExternalLink className="h-5 w-5 text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Ver no CRM</TooltipContent>
              </Tooltip>
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
        </Header>

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
                  {dateMessages.map((message) => {
                    // Internal note rendering
                    if (message.type === 'internal_note') {
                      return (
                        <div key={message.id} className="flex justify-center px-4">
                          <div className="max-w-[85%] w-full rounded-lg px-3 py-2 shadow-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-300/50 dark:border-blue-700/40">
                            <div className="flex items-center gap-1.5 mb-1">
                              <StickyNote className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                Nota Interna
                              </span>
                            </div>
                            <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                              {message.text}
                            </p>
                            <div className="flex items-center justify-between mt-1.5 text-[10px] text-blue-600/70 dark:text-blue-400/60">
                              <span className="font-medium">{message.authorName}</span>
                              <span>{formatTimeSaoPaulo(message.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Normal message rendering
                    return (
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
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-2 border-t bg-muted/20 space-y-1.5">
          {/* Action Bar */}
          <div className="flex items-center gap-0.5 px-1">
            {/* Quick Messages */}
            <Popover open={quickMsgOpen} onOpenChange={setQuickMsgOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!isConfigured}>
                  <Zap className="h-4 w-4 text-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" side="top" align="start">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar mensagem..."
                      value={quickMsgSearch}
                      onChange={e => setQuickMsgSearch(e.target.value)}
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredQuickMessages.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {quickMessages.length === 0 ? 'Nenhuma mensagem rápida cadastrada' : 'Nenhum resultado'}
                      </p>
                    ) : (
                      filteredQuickMessages.map(qm => (
                        <button
                          key={qm.id}
                          className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                          onClick={() => {
                            setNewMessage(prev => prev + qm.message_text);
                            setQuickMsgOpen(false);
                            setQuickMsgSearch('');
                            textareaRef.current?.focus();
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold truncate">{qm.title}</span>
                            {qm.shortcut && (
                              <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 rounded">/{qm.shortcut}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{qm.message_text}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Attach file */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!isConfigured || sendingFile}>
                  {sendingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); }}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Imagem
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { fileInputRef.current?.setAttribute('accept', 'video/*'); fileInputRef.current?.click(); }}>
                  <Video className="h-4 w-4 mr-2" /> Vídeo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { fileInputRef.current?.setAttribute('accept', '*/*'); fileInputRef.current?.click(); }}>
                  <FileText className="h-4 w-4 mr-2" /> Documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Audio recording */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", isRecording && "text-red-500")}
                  disabled={!isConfigured || sendingAudio}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {sendingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Parar e enviar' : 'Gravar áudio'}</TooltipContent>
            </Tooltip>

            {/* Internal Note toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={noteMode ? "default" : "ghost"}
                  size="icon"
                  className={cn("h-7 w-7", noteMode && "bg-blue-500 hover:bg-blue-600 text-white")}
                  onClick={() => setNoteMode(!noteMode)}
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{noteMode ? 'Desativar modo nota' : 'Adicionar nota interna'}</TooltipContent>
            </Tooltip>

            {/* Spacer to push signature toggle to the right */}
            <div className="flex-1" />

            {/* Signature toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[11px] font-medium", signatureEnabled ? "text-primary" : "text-muted-foreground")}>
                    Assinatura
                  </span>
                  <Switch
                    checked={signatureEnabled}
                    onCheckedChange={setSignatureEnabled}
                    className="h-4 w-8 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {signatureEnabled ? 'Assinatura ativa — seu nome será enviado junto' : 'Assinatura desativada'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-red-500/10 rounded-md border border-red-500/20">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400 tabular-nums">
                {formatDuration(recordingTime)}
              </span>
              <span className="text-xs text-muted-foreground flex-1">Gravando...</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-red-500"
                onClick={cancelRecording}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Note mode indicator */}
          {noteMode && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-500/10 rounded-md border border-blue-500/30">
              <StickyNote className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400 flex-1">
                Modo nota interna — não será enviada ao WhatsApp
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-amber-600"
                onClick={() => setNoteMode(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Textarea + Send */}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (noteMode) {
                    handleSendNote();
                  } else {
                    handleSendMessage();
                  }
                }
              }}
              placeholder={noteMode ? "Escreva uma nota interna..." : "Digite uma mensagem..."}
              disabled={!isConfigured || sending || sendingNote || isRecording}
              className={cn(
                "flex-1 min-h-[38px] max-h-[120px] resize-none text-sm py-2",
                noteMode && "border-amber-500/50 focus-visible:ring-amber-500/30"
              )}
              rows={1}
            />
            <Button
              size="icon"
              className={cn(
                "shrink-0 h-[38px] w-[38px]",
                noteMode && "bg-blue-500 hover:bg-blue-600"
              )}
              onClick={noteMode ? handleSendNote : handleSendMessage}
              disabled={!newMessage.trim() || (!isConfigured && !noteMode) || sending || sendingNote || isRecording}
            >
              {sending || sendingNote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : noteMode ? (
                <StickyNote className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !isConfigured) return;
              e.target.value = '';
              
              setSendingFile(true);
              try {
                const cleanNumber = whatsappNumber.replace(/\D/g, '');
                const sendMediaType: 'image' | 'video' | 'audio' | 'document' = file.type.startsWith('image/') ? 'image'
                  : file.type.startsWith('video/') ? 'video'
                  : file.type.startsWith('audio/') ? 'audio'
                  : 'document';

                if (useDbSource && agentLink?.queueId) {
                  // Linked-queue: route file through queue pipeline + chat_messages.
                  await sendViaQueue({ kind: 'media', file, mediaType: sendMediaType });
                  toast.success('Arquivo enviado');
                  return;
                }

                if (provider === 'waba') {
                  // WABA: upload via edge function
                  const reader = new FileReader();
                  const base64 = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });

                  const mediaType = file.type.startsWith('image/') ? 'image'
                    : file.type.startsWith('video/') ? 'video'
                    : file.type.startsWith('audio/') ? 'audio'
                    : 'document';

                  const { data, error } = await supabase.functions.invoke('waba-send', {
                    body: {
                      action: 'send_media',
                      cod_agent: codAgent,
                      to: cleanNumber,
                      media_type: mediaType,
                      base64,
                      mime_type: file.type,
                      file_name: file.name,
                    },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error.message || data.error);
                } else {
                  // UaZapi: convert to base64 and send
                  if (!client) throw new Error('Client not configured');
                  const reader = new FileReader();
                  const base64 = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });

                  await client.post('/send/media', {
                    number: cleanNumber,
                    file: `data:${file.type};base64,${base64}`,
                    type: sendMediaType,
                    fileName: file.name,
                    caption: '',
                  });
                }

                // Add to local state
                const mediaType: MessageType = file.type.startsWith('image/') ? 'image'
                  : file.type.startsWith('video/') ? 'video'
                  : file.type.startsWith('audio/') ? 'audio'
                  : 'document';

                setMessages(prev => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    text: file.name,
                    fromMe: true,
                    timestamp: Date.now(),
                    type: mediaType,
                    fileName: file.name,
                    mimetype: file.type,
                    mediaUrl: URL.createObjectURL(file),
                  },
                ]);

                toast.success('Arquivo enviado');
              } catch (err: any) {
                console.error('Error sending file:', err);
                toast.error('Erro ao enviar arquivo');
              } finally {
                setSendingFile(false);
              }
            }}
          />
        </div>
        </div>
    </>
  );

  // --- Inline variant: no wrapper ---
  if (isInline) {
    return (
      <>
        <div className="flex flex-row h-full w-full bg-background">
          {renderInnerContent()}
        </div>
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
        <CRMLeadDetailsDialog
          card={crmCard || null}
          stages={stages}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
        <PhoneCallDialog
          open={phoneCallOpen}
          onOpenChange={setPhoneCallOpen}
          whatsappNumber={whatsappNumber}
          contactName={displayName || whatsappNumber}
          codAgent={codAgent}
        />
      </>
    );
  }

  return (
    <>
    <Wrapper open={open} onOpenChange={onOpenChange}>
      {/* @ts-ignore - dynamic component props */}
      <Content {...contentProps} aria-describedby={undefined}>
        {renderInnerContent()}
      </Content>
    </Wrapper>

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
    <CRMLeadDetailsDialog
      card={crmCard || null}
      stages={stages}
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
    />
    <PhoneCallDialog
      open={phoneCallOpen}
      onOpenChange={setPhoneCallOpen}
      whatsappNumber={whatsappNumber}
      contactName={displayName || whatsappNumber}
      codAgent={codAgent}
    />
    </>
  );
}
