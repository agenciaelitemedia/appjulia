import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  type?: string;
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
      const instanceName = client.instance;
      
      // Use findMessages endpoint with instance in path
      const endpoint = instanceName 
        ? `/chat/findMessages/${encodeURIComponent(instanceName)}`
        : '/chat/findMessages';
        
      const response = await client.post<{ messages?: Message[] }>(endpoint, {
        where: {
          key: {
            remoteJid: jid,
          },
        },
        limit: 50,
      });

      if (response.messages && Array.isArray(response.messages)) {
        const formattedMessages = response.messages.map((msg: any) => ({
          id: msg.key?.id || msg.id || Math.random().toString(),
          text: msg.message?.conversation || 
                msg.message?.extendedTextMessage?.text || 
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption ||
                '[Mídia]',
          fromMe: msg.key?.fromMe || false,
          timestamp: msg.messageTimestamp || Date.now() / 1000,
          type: Object.keys(msg.message || {})[0],
        }));
        
        // Sort by timestamp ascending
        formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(formattedMessages);
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
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
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
