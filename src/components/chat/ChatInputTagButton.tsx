import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tag as TagIcon, Search, Check, Plus, X } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  conversationId: string | null;
  disabled?: boolean;
}

export function ChatInputTagButton({ conversationId, disabled }: Props) {
  const { tags, createTag, addTagToConversation, removeTagFromConversation } = useWhatsAppData();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const convTagsKey = ['conv-tags', conversationId];
  const { data: activeTags = [] } = useQuery<string[]>({
    queryKey: convTagsKey,
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from('chat_conversation_tags')
        .select('tag_id')
        .eq('conversation_id', conversationId);
      return (data || []).map((t: any) => t.tag_id);
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const activeTagObjs = tags.filter(t => activeTags.includes(t.id));
  const showCreate = search.trim() && !tags.some(t => t.name.toLowerCase() === search.toLowerCase());

  const handleToggle = async (tagId: string) => {
    if (!conversationId) return;
    const tagName = tags.find(t => t.id === tagId)?.name;
    if (activeTags.includes(tagId)) {
      await removeTagFromConversation(conversationId, tagId, tagName);
      queryClient.setQueryData<string[]>(convTagsKey, prev => (prev ?? []).filter(id => id !== tagId));
    } else {
      await addTagToConversation(conversationId, tagId, tagName);
      queryClient.setQueryData<string[]>(convTagsKey, prev => [...(prev ?? []), tagId]);
    }
  };

  const handleCreate = async () => {
    if (!search.trim() || !conversationId) return;
    const tag = await createTag(search.trim(), '#3b82f6');
    if (tag) {
      await addTagToConversation(conversationId, tag.id, tag.name);
      queryClient.setQueryData<string[]>(convTagsKey, prev => [...(prev ?? []), tag.id]);
    }
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0 relative"
          title="Adicionar etiquetas"
          disabled={disabled || !conversationId}
        >
          <TagIcon className="h-5 w-5 text-muted-foreground" />
          {activeTagObjs.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {activeTagObjs.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="top" align="start">
        <div className="p-2 border-b">
          <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1 mb-2">
            <TagIcon className="h-3 w-3" /> Etiquetas da conversa
          </h5>
          {activeTagObjs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {activeTagObjs.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleToggle(tag.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: tag.color }}
                  title="Clique para remover"
                >
                  {tag.name}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma etiqueta aplicada</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <input
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Buscar ou criar etiqueta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && showCreate) {
                e.preventDefault();
                handleCreate();
              }
            }}
            autoFocus
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto py-1">
          {filtered.map(tag => {
            const active = activeTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => handleToggle(tag.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50 text-left',
                  active && 'bg-muted/30'
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate">{tag.name}</span>
                {active && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
              </button>
            );
          })}
          {showCreate && (
            <button
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50 text-left text-primary"
            >
              <Plus className="h-3 w-3 flex-shrink-0" />
              Criar etiqueta "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma etiqueta encontrada</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
