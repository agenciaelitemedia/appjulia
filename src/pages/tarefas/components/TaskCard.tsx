import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Star, Clock, User, Play, CheckCircle, XCircle, Loader2, MoreHorizontal, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Task, TaskStatus } from '@/hooks/useTasks';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: TaskStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isAdmin?: boolean;
  currentUserId?: string;
  compact?: boolean;
}

export function TaskCard({ task, onUpdateStatus, onDelete, isAdmin, currentUserId, compact }: TaskCardProps) {
  const [loading, setLoading] = useState(false);

  const canAct = isAdmin || task.assigned_to === String(currentUserId ?? '');

  const handleStatus = async (s: TaskStatus) => {
    setLoading(true);
    try { await onUpdateStatus(task.id, s); } finally { setLoading(false); }
  };

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 space-y-2 transition-opacity',
      task.status === 'completed' && 'opacity-60',
      compact ? 'p-2.5' : 'p-3',
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium leading-snug', task.status === 'completed' && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          {task.description && !compact && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Pontos */}
          <Badge variant="outline" className="gap-1 text-xs font-semibold text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {task.points}
          </Badge>

          {/* Menu */}
          {(isAdmin || canAct) && task.status !== 'completed' && task.status !== 'cancelled' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {task.status === 'pending' && (
                  <DropdownMenuItem onClick={() => handleStatus('in_progress')}>
                    <Play className="h-3.5 w-3.5 mr-2 text-blue-500" /> Iniciar
                  </DropdownMenuItem>
                )}
                {(task.status === 'pending' || task.status === 'in_progress') && (
                  <DropdownMenuItem onClick={() => handleStatus('completed')}>
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-500" /> Concluir
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleStatus('cancelled')} className="text-destructive">
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                </DropdownMenuItem>
                {isAdmin && onDelete && (
                  <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
        {/* Status */}
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>

        {/* Responsável */}
        {task.assigned_name && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assigned_name}
          </span>
        )}

        {/* Categoria */}
        {task.category && (
          <span className="inline-flex items-center gap-1">
            {task.category}
          </span>
        )}

        {/* Data limite */}
        {task.due_date && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(task.due_date), "d MMM", { locale: ptBR })}
          </span>
        )}

        {/* Criada em */}
        {task.created_at && (
          <span className="inline-flex items-center gap-1" title="Criada em">
            <Clock className="h-3 w-3" />
            Criada {format(new Date(task.created_at), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}

        {/* Concluída em */}
        {task.completed_at && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Concluída em">
            <CheckCircle className="h-3 w-3" />
            Concluída {format(new Date(task.completed_at), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}

        {/* Link para deal */}
        {task.deal_id && !compact && (
          <span className="inline-flex items-center gap-1 text-primary">
            <ExternalLink className="h-3 w-3" /> Card vinculado
          </span>
        )}
      </div>

      {/* Ação rápida: concluir */}
      {canAct && (task.status === 'pending' || task.status === 'in_progress') && !compact && (
        <div className="flex gap-2 pt-1">
          {task.status === 'pending' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-blue-600 border-blue-300"
              disabled={loading} onClick={() => handleStatus('in_progress')}>
              <Play className="h-3 w-3" /> Iniciar
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
            disabled={loading} onClick={() => handleStatus('completed')}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Concluir (+{task.points} pts)
          </Button>
        </div>
      )}
    </div>
  );
}
