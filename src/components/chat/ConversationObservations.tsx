import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, StickyNote } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConversationObservationsProps {
  conversationId: string;
  /** Mantido por compatibilidade com os painéis; não é mais usado. */
  contactId?: string;
  sendInternalNote?: unknown;
}

export function ConversationObservations({ conversationId }: ConversationObservationsProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const queryKey = ['conversation-observations', conversationId];
  const { data: observations, isLoading } = useQuery<string>({
    queryKey,
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('observations')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;
      return (data?.observations as string) || '';
    },
  });

  useEffect(() => {
    if (!isEditing) setText(observations || '');
  }, [observations, isEditing]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ observations: text.trim() || null })
        .eq('id', conversationId);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey });
      setIsEditing(false);
      toast.success('Observações salvas');
    } catch (error) {
      toast.error(`Erro ao salvar observações: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
          <StickyNote className="h-3 w-3" /> Observações
        </h5>
        {!isEditing && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setText(observations || '');
              setIsEditing(true);
            }}
            title="Editar observações"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : isEditing ? (
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
            placeholder="Escreva as observações desta conversa..."
            className="min-h-[80px] resize-none text-xs"
            disabled={isSaving}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setIsEditing(false);
                setText(observations || '');
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      ) : observations ? (
        <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs leading-relaxed text-foreground">
          {observations}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="w-full rounded-md border border-dashed p-2 text-left text-xs text-muted-foreground hover:bg-muted/30"
        >
          Adicionar observações...
        </button>
      )}
    </div>
  );
}
