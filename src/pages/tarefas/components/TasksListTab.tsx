import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, TaskStatus } from '@/hooks/useTasks';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
];

export function TasksListTab() {
  const { user, isAdmin } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : undefined;
  const userId = user?.id ? String(user.id) : undefined;

  const [viewAll, setViewAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const showAll = isAdmin && viewAll;

  const { tasks, isLoading, updateStatus, deleteTask } = useTasks({
    clientId,
    assignedTo: showAll ? undefined : userId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const filtered = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 transition-colors ${!viewAll ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setViewAll(false)}
            >
              Minhas tarefas
            </button>
            <button
              className={`px-3 py-1.5 transition-colors ${viewAll ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setViewAll(true)}
            >
              Todas
            </button>
          </div>
        )}

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefas..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <p className="text-sm">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isAdmin={isAdmin}
              currentUserId={userId}
              onUpdateStatus={async (id, s) => {
                await updateStatus({ id, status: s, completedBy: userId });
              }}
              onDelete={isAdmin ? async (id) => { await deleteTask(id); } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
