import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Star, Clock, User, Play, CheckCircle, XCircle, Loader2, MoreHorizontal, ExternalLink, ChevronDown, ChevronUp, CalendarClock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Task, TaskStatus } from '@/hooks/useTasks';
import { TaskItemsPanel } from './TaskItemsPanel';
import { useTaskItems } from '@/hooks/useTaskItems';

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
  canManage?: boolean;
  currentUserId?: string;
  compact?: boolean;
}

export function TaskCard({ task, onUpdateStatus, onDelete, isAdmin, canManage, currentUserId, compact }: TaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [expanded, setExpanded] = useState(task.status === 'in_progress');

  const isAssignee = task.assigned_to === String(currentUserId ?? '');
  const canAct = isAdmin || isAssignee;
  const canManageItems = !!(canManage || isAdmin || isAssignee);
  const canDelete = task.status === 'pending';

  // contador de itens (lightweight; o painel ainda gerencia internamente)
  const { items } = useTaskItems(expanded ? task.id : undefined, task.client_id);
  const totalItems = expanded ? items.length : (task.items_count ?? 0);
  const doneItems = expanded
    ? items.filter((i) => i.status === 'completed' || i.status === 'cancelled').length
    : ((task.items_done_count ?? 0) + (task.items_cancelled_count ?? 0));
  const hasItems = totalItems > 0;

  // Badge de prazo
  const dueBadge = (() => {
    if (!task.due_date) return null;
    if (task.status === 'completed' || task.status === 'cancelled') return null;
    const due = new Date(task.due_date);
    if (isNaN(due.getTime())) return null;
    const today = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    let cls = 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300';
    let label = 'No prazo';
    if (dueDay < todayDay) {
      cls = 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300';
      label = 'Atrasada';
    } else if (dueDay === todayDay) {
      cls = 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300';
      label = 'Vence hoje';
    }
    return (
      <span
        className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border', cls)}
        title={label}
      >
        <CalendarClock className="h-3 w-3" />
        {format(due, "d MMM", { locale: ptBR })}
      </span>
    );
  })();

  const handleStatus = async (s: TaskStatus) => {
    setLoading(true);
    try { await onUpdateStatus(task.id, s); } finally { setLoading(false); }
  };

  return (
    <div className={cn(
      'rounded-lg border bg-card p-3 space-y-2 transition-opacity',
      (task.status === 'completed' || task.status === 'cancelled') && 'opacity-60',
      compact ? 'p-2.5' : 'p-3',
    )}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
          title={expanded ? 'Ocultar itens' : 'Ver itens'}
        >
          <p className={cn(
            'text-sm font-medium leading-snug',
            (task.status === 'completed' || task.status === 'cancelled') && 'line-through text-muted-foreground',
          )}>
            {task.title}
          </p>
          {task.description && !compact && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </button>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Ocultar itens' : 'Ver itens'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          {/* Pontos */}
          <Badge variant="outline" className="gap-1 text-xs font-semibold text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {task.points}
          </Badge>

          {/* Menu */}
          {canAct && task.status !== 'completed' && task.status !== 'cancelled' && (
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
                <DropdownMenuItem onClick={() => setConfirmCancel(true)} className="text-destructive">
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar tarefa
                </DropdownMenuItem>
                {canManage && onDelete && canDelete && (
                  <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive">
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2">
          {canAct && task.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 w-full text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              disabled={loading}
              onClick={() => handleStatus('in_progress')}
            >
              <Play className="h-3 w-3" /> Iniciar tarefa
            </Button>
          )}
          <TaskItemsPanel
            taskId={task.id}
            clientId={task.client_id}
            taskStatus={task.status}
            canManage={canManageItems}
            currentUserId={currentUserId}
          />
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
        {/* Total de itens */}
        {hasItems && (
          <span className="font-medium">{doneItems}/{totalItems}</span>
        )}

        {/* Status */}
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>

        {/* Prazo */}
        {dueBadge}

        {/* Iniciada em */}
        {task.started_at && (
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Iniciada em">
            <Play className="h-3 w-3" />
            {format(new Date(task.started_at), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}

        {/* Concluída em */}
        {task.completed_at && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Concluída em">
            <CheckCircle className="h-3 w-3" />
            {format(new Date(task.completed_at), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}

        {/* Cancelada em */}
        {task.cancelled_at && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400" title="Cancelada em">
            <XCircle className="h-3 w-3" />
            {format(new Date(task.cancelled_at), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}
      </div>

      {/* Confirmação de exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa <strong>"{task.title}"</strong> será excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (onDelete) await onDelete(task.id);
                setConfirmDelete(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de cancelamento */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa <strong>"{task.title}"</strong> será marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await handleStatus('cancelled');
                setConfirmCancel(false);
              }}
            >
              Cancelar tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
