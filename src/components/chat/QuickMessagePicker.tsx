import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Zap, Variable } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AVAILABLE_VARIABLES } from '@/lib/messageVariables';

interface QuickMessagePickerProps {
  onSelect: (text: string) => void;
}

interface QuickMessage {
  id: string;
  title: string;
  message_text: string;
  shortcut?: string;
  category?: string;
}

export function QuickMessagePicker({ onSelect }: QuickMessagePickerProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      setIsLoading(true);
      const { data } = await supabase
        .from('quick_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .contains('use_locations', ['chat_module'])
        .order('position');
      
      // If no chat_module messages, fallback to chat_popup
      if (!data || data.length === 0) {
        const { data: fallback } = await supabase
          .from('quick_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('position');
        setMessages((fallback || []) as QuickMessage[]);
      } else {
        setMessages(data as QuickMessage[]);
      }
      setIsLoading(false);
    }
    load();
  }, [user?.id]);

  const filtered = search
    ? messages.filter(m => 
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.message_text.toLowerCase().includes(search.toLowerCase()) ||
        m.shortcut?.toLowerCase().includes(search.toLowerCase())
      )
    : messages;

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Mensagens Rápidas</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent">
                <Variable className="h-3 w-3" /> Variáveis
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" side="top" align="end">
              <p className="text-[11px] font-medium mb-1.5">Use estas variáveis no texto:</p>
              <div className="space-y-1">
                {AVAILABLE_VARIABLES.map(v => (
                  <div key={v.key} className="flex items-center justify-between text-[11px] gap-2">
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{`{{${v.key}}}`}</code>
                    <span className="text-muted-foreground truncate">{v.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Substituídas no envio.</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
      </div>
      <ScrollArea className="max-h-60">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma mensagem rápida encontrada
          </div>
        ) : (
          <div className="p-1">
            {filtered.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelect(msg.message_text)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{msg.title}</span>
                  {msg.shortcut && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                      /{msg.shortcut}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {msg.message_text.slice(0, 80)}{msg.message_text.length > 80 ? '...' : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
