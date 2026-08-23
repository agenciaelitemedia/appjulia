import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Minimize2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebChatWidgetPreviewProps {
  config: {
    widget_title: string;
    welcome_message: string;
    primary_color: string;
    logo_url?: string;
    position: string;
    collect_name: boolean;
    collect_email: boolean;
  };
}

interface PreviewMessage {
  id: string;
  text: string;
  from_me: boolean;
  timestamp: string;
  sender_name?: string;
}

/**
 * WebChat Widget Preview — shows how the widget looks for end-users.
 * Used inside the admin config page. The actual embeddable widget would
 * be a standalone JS file deployed separately.
 */
export function WebChatWidgetPreview({ config }: WebChatWidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'chat'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { primary_color, widget_title, welcome_message, logo_url, collect_name, collect_email } = config;

  useEffect(() => {
    if (!collect_name && !collect_email) {
      setStep('chat');
    }
  }, [collect_name, collect_email]);

  useEffect(() => {
    if (step === 'chat' && messages.length === 0 && welcome_message) {
      setMessages([{
        id: 'welcome',
        text: welcome_message,
        from_me: false,
        timestamp: new Date().toISOString(),
        sender_name: 'Atendente',
      }]);
    }
  }, [step, welcome_message]);

  const handleStartChat = () => {
    if (collect_name && !name.trim()) return;
    setStep('chat');
  };

  const handleSend = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: text.trim(),
      from_me: true,
      timestamp: new Date().toISOString(),
      sender_name: name || 'Visitante',
    }]);
    setText('');

    // Simulate response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Obrigado pela sua mensagem! Um atendente responderá em breve.',
        from_me: false,
        timestamp: new Date().toISOString(),
        sender_name: 'Atendente',
      }]);
    }, 1500);
  };

  const isRight = config.position === 'bottom-right';

  return (
    <div className="relative w-full h-[500px] bg-muted/30 rounded-lg border overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
        Preview do Widget
      </div>

      {/* Chat bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'absolute bottom-4 z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white transition-transform hover:scale-110',
            isRight ? 'right-4' : 'left-4'
          )}
          style={{ backgroundColor: primary_color }}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-4 z-10 w-[340px] bg-background rounded-xl shadow-2xl border overflow-hidden flex flex-col',
            isRight ? 'right-4' : 'left-4'
          )}
          style={{ height: '420px' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: primary_color }}
          >
            {logo_url ? (
              <img src={logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{widget_title}</h4>
              <p className="text-xs opacity-80">Online</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === 'form' ? (
            /* Pre-chat form */
            <div className="flex-1 flex flex-col p-4 gap-3">
              <p className="text-sm text-muted-foreground">{welcome_message}</p>
              {collect_name && (
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />
              )}
              {collect_email && (
                <Input
                  placeholder="Seu email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                />
              )}
              <Button
                onClick={handleStartChat}
                className="mt-auto text-white"
                style={{ backgroundColor: primary_color }}
              >
                Iniciar conversa
              </Button>
            </div>
          ) : (
            /* Chat area */
            <>
              <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex', msg.from_me ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                          msg.from_me
                            ? 'text-white rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        )}
                        style={msg.from_me ? { backgroundColor: primary_color } : undefined}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-2 border-t flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="text-sm flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  className="text-white shrink-0"
                  style={{ backgroundColor: primary_color }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
