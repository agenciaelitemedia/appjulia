import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-chat`;

export function CopilotChatTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from DB on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('crm_copilot_chat_messages')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(50);
        if (!error && data) {
          setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        }
      } catch {} finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = useCallback(async (role: 'user' | 'assistant', content: string) => {
    if (!user?.id) return;
    await supabase.from('crm_copilot_chat_messages').insert({
      user_id: user.id,
      role,
      content,
    });
  }, [user?.id]);

  const clearHistory = async () => {
    if (!user?.id) return;
    await supabase
      .from('crm_copilot_chat_messages')
      .delete()
      .eq('user_id', user.id);
    setMessages([]);
    toast.success('Conversa limpa');
  };

  const send = async () => {
    if (!input.trim() || !user?.id || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setInput('');
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Save user message to DB
    await saveMessage('user', userMsg.content);

    // Build history (last 20 messages before the new one)
    const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }));

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message: userMsg.content, userId: user.id, history }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        const errMsg = `Erro: ${resp.status} - ${errText}`;
        setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
        await saveMessage('assistant', errMsg);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save complete assistant response to DB
      if (assistantSoFar) {
        await saveMessage('assistant', assistantSoFar);
      }
    } catch (err) {
      const errMsg = 'Erro ao conectar com o copiloto. Tente novamente.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
      await saveMessage('assistant', errMsg);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
            <p className="text-sm font-medium">Pergunte sobre seus leads</p>
            <p className="text-xs mt-1 max-w-[240px]">
              Ex: "Quais leads estão parados há mais de 3 dias?" ou "Resumo do meu CRM hoje"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg p-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-8'
                    : 'bg-muted mr-8'
                )}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="bg-muted rounded-lg p-3 mr-8 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs text-muted-foreground">Analisando...</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        {messages.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            onClick={clearHistory}
            className="shrink-0"
            title="Limpar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre seus leads..."
          className="min-h-[40px] max-h-[100px] resize-none text-sm"
          rows={1}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || isLoading} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
