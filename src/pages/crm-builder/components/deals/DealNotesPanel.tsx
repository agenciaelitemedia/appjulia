import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Send, Loader2, StickyNote, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { CRMDealHistory } from '../../types';

interface DealNotesPanelProps {
  notes: CRMDealHistory[];
  isLoading: boolean;
  onAddNote?: (note: string) => Promise<boolean>;
}

export function DealNotesPanel({ notes, isLoading, onAddNote }: DealNotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newNote.trim() || !onAddNote) return;
    setIsSubmitting(true);
    const ok = await onAddNote(newNote.trim());
    if (ok) setNewNote('');
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {/* Input para nova anotação */}
      {onAddNote && (
        <div className="space-y-2">
          <Textarea
            placeholder="Escreva uma anotação sobre este card..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter para salvar</span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newNote.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Salvar anotação
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de anotações */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-1.5 p-3 rounded-lg border">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma anotação ainda</p>
          <p className="text-xs mt-1">Adicione informações relevantes sobre este card</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <MessageSquare className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(note.changed_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {note.changed_by && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-background rounded-full px-1.5 py-0.5 border">
                    <User className="h-2.5 w-2.5" />
                    {note.changed_by}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
