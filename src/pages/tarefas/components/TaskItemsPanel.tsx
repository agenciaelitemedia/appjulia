import { useState } from 'react';
import { useTaskItems } from '@/hooks/useTaskItems';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, RotateCcw, Loader2, Lock, LockOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  taskId: string;
  clientId?: string;
  taskStatus: string;
  canManage: boolean;
  currentUserId?: string;
}

export function TaskItemsPanel({ taskId, clientId, taskStatus, canManage, currentUserId }: Props) {
  const { items, isLoading, completeItem, cancelItem, reopenItem, removeItem } = useTaskItems(taskId, clientId);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> carregando itens...</div>;
  }
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground py-2 italic">Esta tarefa não tem itens.</div>;
  }

  const canActOnItems = canManage && taskStatus === 'in_progress';

  const wrap = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const total = items.length;
  const completed = items.filter((i) => i.status === 'completed').length;
  const cancelled = items.filter((i) => i.status === 'cancelled').length;

  return (
    <div className="space-y-1.5 border-t pt-2 mt-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{completed}/{total} concluídos{cancelled > 0 ? ` • ${cancelled} cancelados` : ''}</span>
      </div>
      {items.map((it) => (
        <div key={it.id} className={cn(
          'flex items-start gap-2 rounded border bg-background/50 px-2 py-1.5',
          it.status === 'completed' && 'opacity-70',
          it.status === 'cancelled' && 'opacity-50',
        )}>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-medium leading-snug flex items-center gap-1',
              it.status === 'completed' && 'line-through',
              it.status === 'cancelled' && 'line-through text-muted-foreground')}>
              {it.is_required
                ? <Lock className="h-3 w-3 text-amber-600 flex-shrink-0" aria-label="Item obrigatório" />
                : <LockOpen className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-label="Item opcional" />}
              {it.title}
            </p>
            {it.description && <p className="text-[11px] text-muted-foreground mt-0.5">{it.description}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {busyId === it.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}

            {canActOnItems && it.status === 'pending' && (
              <>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700"
                  title="Concluir item"
                  onClick={() => wrap(it.id, () => completeItem({ id: it.id, userId: currentUserId }))}>
                  <CheckCircle className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-600"
                  title={it.is_required ? 'Item obrigatório não pode ser cancelado' : 'Cancelar item'}
                  disabled={it.is_required}
                  onClick={() => wrap(it.id, () => cancelItem({ id: it.id, userId: currentUserId }))}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {canActOnItems && it.status !== 'pending' && (
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Reabrir item"
                onClick={() => wrap(it.id, () => reopenItem(it.id))}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}