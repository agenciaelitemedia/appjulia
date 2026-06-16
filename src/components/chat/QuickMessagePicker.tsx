import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Zap, FileText, Image as ImageIcon, Video, Mic, Paperclip, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { interpolateVariables } from '@/lib/messageVariables';

type Kind = 'text' | 'image' | 'video' | 'audio' | 'document' | 'link';

interface QuickMessagePickerProps {
  onSelect: (text: string) => void;
  onSelectMedia?: (m: {
    url: string; mime: string | null; filename: string | null;
    kind: 'image' | 'video' | 'audio' | 'document'; caption: string;
  }) => void;
  contactName?: string | null;
  protocol?: string | null;
  agentName?: string | null;
}

interface QuickMessage {
  id: string;
  title: string;
  message_text: string | null;
  shortcut?: string | null;
  kind: Kind;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  link_url: string | null;
  link_title: string | null;
}

const KIND_ICON: Record<Kind, any> = {
  text: FileText, image: ImageIcon, video: Video,
  audio: Mic, document: Paperclip, link: LinkIcon,
};

export function QuickMessagePicker({ onSelect, onSelectMedia, contactName, protocol, agentName }: QuickMessagePickerProps) {
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
        .order('position');
      setMessages((data || []) as any as QuickMessage[]);
      setIsLoading(false);
    }
    load();
  }, [user?.id]);

  const filtered = search
    ? messages.filter(m => 
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.message_text || '').toLowerCase().includes(search.toLowerCase()) ||
        m.shortcut?.toLowerCase().includes(search.toLowerCase())
      )
    : messages;

  const ctx = { contactName: contactName ?? null, protocol: protocol ?? null, agentName: agentName ?? null };

  const handlePick = (msg: QuickMessage) => {
    const k = (msg.kind || 'text') as Kind;
    const baseText = interpolateVariables(msg.message_text || '', ctx);
    if (k === 'text') {
      onSelect(baseText);
      return;
    }
    if (k === 'link') {
      const url = msg.link_url || '';
      onSelect(baseText ? `${baseText}\n${url}` : url);
      return;
    }
    if (msg.media_url && onSelectMedia) {
      onSelectMedia({
        url: msg.media_url,
        mime: msg.media_mime,
        filename: msg.media_filename,
        kind: k as 'image' | 'video' | 'audio' | 'document',
        caption: baseText,
      });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Mensagens Rápidas</span>
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
            {filtered.map((msg) => {
              const k = (msg.kind || 'text') as Kind;
              const Icon = KIND_ICON[k];
              const sub = k === 'link'
                ? (msg.link_title || msg.link_url || '')
                : (k === 'text' ? (msg.message_text || '') : (msg.media_filename || msg.message_text || ''));
              return (
                <button
                  key={msg.id}
                  onClick={() => handlePick(msg)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors flex items-start gap-2"
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{msg.title}</span>
                      {msg.shortcut && (
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                          /{msg.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {sub.slice(0, 80)}{sub.length > 80 ? '...' : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
