import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, StickyNote } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ConversationObservation {
  id: string;
  text: string | null;
  timestamp: string;
  created_at: string;
  sender_name: string | null;
  note_type: string | null;
}

interface ConversationObservationsProps {
  conversationId: string;
  contactId: string;
  sendInternalNote: (
    contactId: string,
    text: string,
    senderName: string,
    options?: { noteType?: 'info' | 'question' | 'urgent'; extraMetadata?: Record<string, unknown> }
  ) => Promise<void>;
}

export function ConversationObservations({ conversationId, contactId, sendInternalNote }: ConversationObservationsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const queryKey = ['conversation-observations', conversationId];
  const { data: observations = [], isLoading } = useQuery<ConversationObservation[]>({
    queryKey,
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id,text,timestamp,created_at,sender_name,note_type')
        .eq('conversation_id', conversationId)
        .eq('internal_note', true)
        .order('timestamp', { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data || []) as ConversationObservation[];
    },
  });

  const handleSave = async () => {
    const value = text.trim();
    if (!value || isSaving) return;

    setIsSaving(true);
    try {
      await sendInternalNote(contactId, value, user?.name || user?.email || 'Atendente', {
        noteType: 'info',
        extraMetadata: { observation: true },
      });
      setText('');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      toast.success('Observação salva');
    } catch (error) {
      toast.error(`Erro ao salvar observação: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> Observações
        </h5>
      </div>

      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              handleSave();
            }
          }}
          placeholder="Adicionar observação..."
          className="min-h-[68px] resize-none text-xs"
          disabled={isSaving}
        />
        <div className="flex justify-end">
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={!text.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando observações...</p>
        ) : observations.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem observações</p>
        ) : (
          observations.map((observation) => (
            <div key={observation.id} className="rounded-md border bg-muted/30 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate font-medium">{observation.sender_name || 'Atendente'}</span>
                <span className="shrink-0">
                  {format(new Date(observation.timestamp || observation.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </span>
              </div>
              <p className={cn('whitespace-pre-wrap leading-relaxed text-foreground', !observation.text && 'text-muted-foreground italic')}>
                {observation.text || 'Sem conteúdo'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}