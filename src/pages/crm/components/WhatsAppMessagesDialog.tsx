import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Loader2, 
  Mic, FileText, Download, MapPin, User, Image as ImageIcon, Video, Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { externalDb } from '@/lib/externalDb';
import { UaZapiClient } from '@/lib/uazapi';

// ============================================
// Types
// ============================================

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';

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
}

interface AgentCredentials {
  api_url: string;
  api_key: string;
  api_instance?: string;
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
function renderTextWithLinks(text: string): React.ReactNode {
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
function QuotedMessage({ text, participant, isFromMe }: { 
  text?: string; 
  participant?: string;
  isFromMe: boolean;
}) {
  if (!text) return null;
  
  return (
    <div className={cn(
      "border-l-2 pl-2 mb-2 text-xs rounded-r",
      isFromMe 
        ? "border-primary/60 bg-primary-foreground/10" 
        : "border-primary/80 bg-background/30"
    )}>
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
}

function detectMessageType(message: any): MessageType {
  if (!message || typeof message !== 'object') return 'unknown';
  
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
  
  // Verificar se texto está em 'body' ou 'text' direto
  if (message.body || message.text || message.content) return 'text';
  
  // Verificar messageType alternativo
  if (message.messageType) {
    const typeMap: Record<string, MessageType> = {
      'text': 'text',
      'chat': 'text',
      'conversation': 'text',
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
    return typeMap[message.messageType] || 'unknown';
  }
  
  return 'unknown';
}

function extractMediaData(message: any, type: MessageType): Partial<Message> {
  if (!message) return { text: '[Mensagem vazia]' };
  
  switch (type) {
    case 'text':
      return {
        text: message.conversation 
          || message.extendedTextMessage?.text 
          || message.body 
          || message.text 
          || message.content
          || '',
      };
      
    case 'image':
      return {
        mediaUrl: message.imageMessage?.url,
        caption: message.imageMessage?.caption,
        mimetype: message.imageMessage?.mimetype,
        thumbnail: message.imageMessage?.jpegThumbnail,
        text: message.imageMessage?.caption || '[Imagem]',
      };
      
    case 'audio':
      return {
        mediaUrl: message.audioMessage?.url,
        seconds: message.audioMessage?.seconds,
        ptt: message.audioMessage?.ptt,
        mimetype: message.audioMessage?.mimetype,
        text: `[Áudio ${formatDuration(message.audioMessage?.seconds)}]`,
      };
      
    case 'video':
      return {
        mediaUrl: message.videoMessage?.url,
        caption: message.videoMessage?.caption,
        mimetype: message.videoMessage?.mimetype,
        seconds: message.videoMessage?.seconds,
        thumbnail: message.videoMessage?.jpegThumbnail,
        text: message.videoMessage?.caption || '[Vídeo]',
      };
      
    case 'document': {
      const doc = message.documentMessage || message.documentWithCaptionMessage?.message?.documentMessage;
      return {
        mediaUrl: doc?.url,
        fileName: doc?.fileName || doc?.title,
        mimetype: doc?.mimetype,
        caption: doc?.caption,
        text: doc?.fileName || doc?.title || '[Documento]',
      };
    }
      
    case 'sticker':
      return {
        mediaUrl: message.stickerMessage?.url,
        mimetype: message.stickerMessage?.mimetype,
        text: '[Sticker]',
      };
      
    case 'location':
      return {
        latitude: message.locationMessage?.degreesLatitude,
        longitude: message.locationMessage?.degreesLongitude,
        text: message.locationMessage?.name || '[Localização]',
      };
      
    case 'contact': {
      const contact = message.contactMessage || message.contactsArrayMessage?.contacts?.[0];
      return {
        text: contact?.displayName || '[Contato]',
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

function MessageBubble({ message }: { message: Message }) {
  const isFromMe = message.fromMe;
  
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
        
      case 'image':
        return (
          <div className="space-y-1">
            {message.mediaUrl ? (
              <img 
                src={message.mediaUrl} 
                alt="Imagem" 
                className="max-w-full max-h-[200px] rounded-md cursor-pointer object-cover"
                onClick={() => window.open(message.mediaUrl, '_blank')}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={cn("flex items-center gap-2 p-2 rounded", message.mediaUrl ? "hidden" : "")}>
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Imagem não disponível</span>
            </div>
            {message.caption && (
              <p className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.caption)}</p>
            )}
          </div>
        );
        
      case 'audio':
        return (
          <div className="flex items-center gap-2 min-w-[180px]">
            {message.ptt ? (
              <Mic className="h-4 w-4 flex-shrink-0 text-green-500" />
            ) : (
              <Play className="h-4 w-4 flex-shrink-0" />
            )}
            {message.mediaUrl ? (
              <audio 
                controls 
                src={message.mediaUrl} 
                className="max-w-[180px] h-8"
                preload="metadata"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1 bg-muted-foreground/30 rounded" />
                <span className="text-xs text-muted-foreground">
                  {formatDuration(message.seconds)}
                </span>
              </div>
            )}
          </div>
        );
        
      case 'video':
        return (
          <div className="space-y-1">
            {message.mediaUrl ? (
              <video 
                controls 
                src={message.mediaUrl} 
                className="max-w-full max-h-[200px] rounded-md"
                preload="metadata"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-background/50 rounded">
                <Video className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Vídeo não disponível</span>
              </div>
            )}
            {message.caption && (
              <p className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.caption)}</p>
            )}
          </div>
        );
        
      case 'document':
        return (
          <a 
            href={message.mediaUrl || '#'} 
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-2 rounded transition-colors",
              isFromMe ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-background/50 hover:bg-background/80"
            )}
            onClick={(e) => {
              if (!message.mediaUrl) {
                e.preventDefault();
              }
            }}
          >
            <FileText className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm truncate flex-1 max-w-[150px]">
              {message.fileName || 'Documento'}
            </span>
            {message.mediaUrl && <Download className="h-4 w-4 flex-shrink-0" />}
          </a>
        );
        
      case 'sticker':
        return (
          <img 
            src={message.mediaUrl} 
            alt="Sticker" 
            className="max-w-[120px] max-h-[120px]"
            onError={(e) => {
              e.currentTarget.src = '';
              e.currentTarget.alt = '[Sticker]';
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
  
  return renderContent();
}

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
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [client, setClient] = useState<UaZapiClient | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (open && whatsappNumber && client && isConfigured) {
      loadMessages();
    }
  }, [open, whatsappNumber, client, isConfigured]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadAgentCredentials = async () => {
    setLoading(true);
    try {
      const result = await externalDb.raw<AgentCredentials>({
        query: `
          SELECT api_url, api_key, api_instance 
          FROM "vw_list_client-agents-users" 
          WHERE cod_agent = $1 
          LIMIT 1
        `,
        params: [codAgent],
      });

      if (result && result.length > 0) {
        const creds = result[0];
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

  const loadMessages = async () => {
    if (!client || !isConfigured) {
      return;
    }

    setLoading(true);
    try {
      const jid = formatToJid(whatsappNumber);
      
      // Endpoint correto conforme documentação da UaZapi
      const endpoint = '/message/find';
      const requestBody = {
        chatid: jid,
        limit: 50,
        offset: 0,
      };
      
      console.log('🔍 [WhatsApp API] Loading messages:', {
        baseUrl: client.baseUrl,
        endpoint,
        requestBody,
      });
        
      const response = await client.post<any>(endpoint, requestBody);

      // Processar resposta (pode vir como array direto ou dentro de objeto)
      const messagesArray = Array.isArray(response) ? response : (response?.messages || []);
      
      console.log('📨 [WhatsApp API] Raw messages:', messagesArray.length, 'messages');
      
      // Debug: Log da estrutura completa da primeira mensagem
      if (messagesArray.length > 0) {
        console.log('🔬 [WhatsApp API] First message structure:', 
          JSON.stringify(messagesArray[0], null, 2)
        );
        console.log('🔬 [WhatsApp API] Message keys:', 
          Object.keys(messagesArray[0])
        );
        if (messagesArray[0].message) {
          console.log('🔬 [WhatsApp API] msg.message keys:', 
            Object.keys(messagesArray[0].message)
          );
        }
      }
      
      if (messagesArray.length > 0) {
        const formattedMessages: Message[] = messagesArray.map((msg: any) => {
          // Tentar pegar de msg.message (Baileys) ou direto de msg
          const messageContent = msg.message || msg;
          const messageType = detectMessageType(messageContent);
          const mediaData = extractMediaData(messageContent, messageType);
          
          // Debug log para primeiras mensagens
          if (messagesArray.indexOf(msg) < 3) {
            console.log('🔬 [WhatsApp API] Parsed message:', {
              originalKeys: Object.keys(msg),
              contentKeys: Object.keys(messageContent),
              detectedType: messageType,
              extractedText: mediaData.text?.substring(0, 50),
            });
          }
          
          // Extrair dados da mensagem citada (quoted message)
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
            timestamp: msg.messageTimestamp || msg.timestamp || Date.now() / 1000,
            // Quoted message data
            quotedId: msg.quoted || contextInfo?.stanzaId,
            quotedText: quotedText,
            quotedParticipant: contextInfo?.participant,
          };
        });
        
        // Sort by timestamp ascending
        formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(formattedMessages);
        
        const typeCounts = formattedMessages.reduce((acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('✅ [WhatsApp API] Processed messages:', formattedMessages.length, 'Type breakdown:', typeCounts);
      } else {
        setMessages([]);
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !client || sending) return;

    setSending(true);
    try {
      const instanceName = client.instance;
      const endpoint = instanceName 
        ? `/message/sendText/${encodeURIComponent(instanceName)}`
        : '/message/text';
        
      await client.post(endpoint, {
        number: whatsappNumber.replace(/\D/g, ''),
        text: newMessage.trim(),
      });

      // Add message to local state
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          text: newMessage.trim(),
          fromMe: true,
          timestamp: Date.now() / 1000,
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

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatMessageDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-primary/5">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => loadMessages()}
              disabled={loading}
            >
              <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
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
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date} className="space-y-2">
                  {/* Date separator */}
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground">
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
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted rounded-bl-none"
                        )}
                      >
                        <MessageBubble message={message} />
                        <p
                          className={cn(
                            "text-[10px] mt-1 text-right",
                            message.fromMe
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatMessageTime(message.timestamp)}
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
        <div className="p-3 border-t bg-background">
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
          {!isConfigured && (
            <p className="text-[10px] text-destructive mt-1">
              Configure as credenciais da UaZapi para enviar mensagens
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
