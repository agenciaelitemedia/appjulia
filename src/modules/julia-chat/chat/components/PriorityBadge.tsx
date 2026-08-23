import React from 'react';
import { Flag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string; dot: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  { value: 'normal', label: 'Normal', color: 'text-blue-500', dot: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'text-amber-500', dot: 'bg-amber-500' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-500', dot: 'bg-red-500' },
];

interface PriorityBadgeProps {
  conversationId: string;
  currentPriority?: string | null;
  compact?: boolean;
}

export function PriorityBadge({ conversationId, currentPriority, compact }: PriorityBadgeProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const current = (currentPriority as Priority) || 'normal';
  const currentOpt = PRIORITY_OPTIONS.find(o => o.value === current) || PRIORITY_OPTIONS[1];

  const handleSelect = async (e: React.MouseEvent, priority: Priority) => {
    e.stopPropagation();
    if (priority === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ priority })
        .eq('id', conversationId);
      if (error) throw error;
      const newLabel = PRIORITY_OPTIONS.find(o => o.value === priority)?.label ?? priority;
      const oldLabel = PRIORITY_OPTIONS.find(o => o.value === current)?.label ?? current;
      toast.success(`Prioridade alterada para ${newLabel}`);
      supabase.from('chat_conversation_history').insert({
        conversation_id: conversationId,
        action: 'priority_changed',
        actor_name: user?.name || user?.email || 'Sistema',
        from_value: oldLabel,
        to_value: newLabel,
        user_id: user?.id ? Number(user.id) : null,
      }).then();
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setOpen(false);
    } catch (err) {
      console.error('[PriorityBadge] update error', err);
      toast.error('Erro ao alterar prioridade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); }}
          disabled={saving}
          title={`Prioridade: ${currentOpt.label}`}
          className={cn(
            'inline-flex items-center justify-center rounded hover:bg-accent transition-colors',
            compact ? 'h-5 w-5' : 'h-6 w-6',
            saving && 'opacity-50'
          )}
        >
          <Flag className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', currentOpt.color, 'fill-current')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-44 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase">
          Definir prioridade
        </div>
        {PRIORITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={(e) => handleSelect(e, opt.value)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left',
              opt.value === current && 'bg-accent/60 font-semibold'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', opt.dot)} />
            <Flag className={cn('h-3 w-3 fill-current', opt.color)} />
            <span>{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
