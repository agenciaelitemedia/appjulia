import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowRight, 
  Clock, 
  Edit3, 
  MessageSquare, 
  Plus,
  Trophy,
  XCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { CRMDealHistory, DealHistoryAction } from '../../types';

interface DealActivityTimelineProps {
  history: CRMDealHistory[];
  isLoading: boolean;
  onAddNote?: (note: string) => Promise<boolean>;
}

const ACTION_CONFIG: Record<DealHistoryAction, { 
  icon: typeof Plus; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  created: { 
    icon: Plus, 
    label: 'Deal criado', 
    color: 'text-primary', 
    bgColor: 'bg-primary/10' 
  },
  moved: { 
    icon: ArrowRight, 
    label: 'Movido', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100' 
  },
  updated: { 
    icon: Edit3, 
    label: 'Atualizado', 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-100' 
  },
  note_added: { 
    icon: MessageSquare, 
    label: 'Nota adicionada', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100' 
  },
  won: { 
    icon: Trophy, 
    label: 'Marcado como ganho', 
    color: 'text-primary', 
    bgColor: 'bg-primary/10' 
  },
  lost: { 
    icon: XCircle, 
    label: 'Marcado como perdido', 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10' 
  },
};

export function DealActivityTimeline({
  history,
  isLoading,
  onAddNote,
}: DealActivityTimelineProps) {
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleSubmitNote = async () => {
    if (!newNote.trim() || !onAddNote) return;
    
    setIsSubmitting(true);
    const success = await onAddNote(newNote);
    if (success) {
      setNewNote('');
      setShowNoteInput(false);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Note Button / Input */}
      {onAddNote && (
        <div className="space-y-2">
          {showNoteInput ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Escreva uma nota sobre este deal..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowNoteInput(false);
                    setNewNote('');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSubmitNote}
                  disabled={!newNote.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Adicionar Nota
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowNoteInput(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Adicionar Nota
            </Button>
          )}
        </div>
      )}

      {/* Timeline */}
      {history.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />

          {history.map((item) => {
            const config = ACTION_CONFIG[item.action as DealHistoryAction] || ACTION_CONFIG.updated;
            const Icon = config.icon;

            return (
              <div key={item.id} className="relative flex gap-3 pl-0">
                {/* Icon */}
                <div className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full',
                  config.bgColor
                )}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.changed_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Movement details */}
                  {item.action === 'moved' && item.from_pipeline_name && item.to_pipeline_name && (
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${item.from_pipeline_color}20`,
                          color: item.from_pipeline_color,
                        }}
                      >
                        {item.from_pipeline_name}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${item.to_pipeline_color}20`,
                          color: item.to_pipeline_color,
                        }}
                      >
                        {item.to_pipeline_name}
                      </span>
                    </div>
                  )}

                  {/* Note content */}
                  {item.notes && (
                    <p className="mt-1 text-sm text-foreground bg-muted/50 rounded-lg p-2">
                      {item.notes}
                    </p>
                  )}

                  {/* Changes summary */}
                  {item.action === 'updated' && item.changes && Object.keys(item.changes).length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Campos alterados: {Object.keys(item.changes).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
