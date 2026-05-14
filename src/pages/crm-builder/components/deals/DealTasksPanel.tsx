import { useState } from 'react';
import { CheckSquare, Plus, Trash2, Loader2, ListChecks, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils';
import { useCRMDealTasks } from '../../hooks/useCRMDealTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { TaskCard } from '@/pages/tarefas/components/TaskCard';
import { AddRankedTasksDialog } from '@/pages/tarefas/components/AddRankedTasksDialog';
import type { TaskStatus } from '@/hooks/useTasks';

interface DealTasksPanelProps {
  dealId: string;
}

interface DeleteTarget {
  type: 'checklist' | 'item';
  id: string;
  label: string;
}

export function DealTasksPanel({ dealId }: DealTasksPanelProps) {
  const { checklists, isLoading, createChecklist, deleteChecklist, addItem, toggleItem, deleteItem, totalTasks, doneTasks } =
    useCRMDealTasks(dealId);

  const { user, isAdmin } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : undefined;
  const userId = user?.id ? String(user.id) : undefined;
  const { tasks: rankedTasks, updateStatus } = useTasks({ clientId, dealId });

  const [showRankedDialog, setShowRankedDialog] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [newItemTitles, setNewItemTitles] = useState<Record<string, string>>({});
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [savingItemFor, setSavingItemFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const handleCreateChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    setSavingChecklist(true);
    await createChecklist(newChecklistTitle);
    setNewChecklistTitle('');
    setAddingChecklist(false);
    setSavingChecklist(false);
  };

  const handleAddItem = async (checklistId: string) => {
    const title = newItemTitles[checklistId]?.trim();
    if (!title) return;
    setSavingItemFor(checklistId);
    await addItem(checklistId, title);
    setNewItemTitles((prev) => ({ ...prev, [checklistId]: '' }));
    setSavingItemFor(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'checklist') {
      await deleteChecklist(deleteTarget.id);
    } else {
      await deleteItem(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* Resumo global */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{doneTasks} de {totalTasks} {totalTasks === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%` }}
              />
            </div>
            <span className="font-medium">{totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%</span>
          </div>
        )}

        {/* Checklists */}
        {checklists.map((cl) => {
          const clTotal = cl.items?.length ?? 0;
          const clDone  = cl.items?.filter((i) => i.is_completed).length ?? 0;
          const pct     = clTotal > 0 ? Math.round((clDone / clTotal) * 100) : 0;

          return (
            <div key={cl.id} className="space-y-2">
              {/* Cabeçalho do checklist */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{cl.title}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{clDone}/{clTotal}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => setDeleteTarget({ type: 'checklist', id: cl.id, label: cl.title })}
                  title="Excluir checklist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Barra de progresso */}
              {clTotal > 0 && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct === 100 ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {/* Itens */}
              <div className="space-y-1 pl-1">
                {cl.items?.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2 py-0.5">
                    <Checkbox
                      checked={item.is_completed}
                      onCheckedChange={(checked) => toggleItem(item.id, !!checked)}
                      className="flex-shrink-0"
                    />
                    <span className={cn(
                      'flex-1 text-sm leading-snug',
                      item.is_completed && 'line-through text-muted-foreground'
                    )}>
                      {item.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => setDeleteTarget({ type: 'item', id: item.id, label: item.title })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Adicionar item */}
              {addingItemFor === cl.id ? (
                <div className="flex items-center gap-2 pl-1">
                  <Input
                    autoFocus
                    value={newItemTitles[cl.id] || ''}
                    onChange={(e) => setNewItemTitles((prev) => ({ ...prev, [cl.id]: e.target.value }))}
                    placeholder="Nome da tarefa..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddItem(cl.id);
                      if (e.key === 'Escape') setAddingItemFor(null);
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleAddItem(cl.id)}
                    disabled={savingItemFor === cl.id}
                  >
                    {savingItemFor === cl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAddingItemFor(null)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground gap-1.5 pl-1"
                  onClick={() => setAddingItemFor(cl.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar tarefa
                </Button>
              )}
            </div>
          );
        })}

        {/* Seção de Tarefas Rankeadas */}
        {rankedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
              Tarefas Rankeadas
            </div>
            {rankedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                compact
                isAdmin={isAdmin}
                currentUserId={userId}
                onUpdateStatus={async (id, s: TaskStatus) => {
                  await updateStatus({ id, status: s, completedBy: userId });
                }}
              />
            ))}
          </div>
        )}

        {/* Botão adicionar tarefas rankeadas */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          onClick={() => setShowRankedDialog(true)}
        >
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          Adicionar Tarefas Rankeadas
        </Button>

        {/* Adicionar checklist */}
        {addingChecklist ? (
          <div className="space-y-2 border rounded-lg p-3">
            <Input
              autoFocus
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              placeholder="Nome do checklist..."
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChecklist();
                if (e.key === 'Escape') { setAddingChecklist(false); setNewChecklistTitle(''); }
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateChecklist} disabled={savingChecklist || !newChecklistTitle.trim()}>
                {savingChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingChecklist(false); setNewChecklistTitle(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setAddingChecklist(true)}
          >
            <Plus className="h-4 w-4" />
            Adicionar checklist
          </Button>
        )}

        {checklists.length === 0 && !addingChecklist && (
          <div className="text-center py-6 text-muted-foreground">
            <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma tarefa ainda</p>
            <p className="text-xs mt-1">Crie um checklist para organizar as etapas deste card</p>
          </div>
        )}
      </div>

      {/* Dialog de tarefas rankeadas */}
      {clientId && (
        <AddRankedTasksDialog
          open={showRankedDialog}
          onOpenChange={setShowRankedDialog}
          dealId={dealId}
          clientId={clientId}
        />
      )}

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'checklist' ? 'Excluir checklist?' : 'Excluir tarefa?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'checklist'
                ? <>O checklist <strong>"{deleteTarget.label}"</strong> e todas as suas tarefas serão excluídos permanentemente.</>
                : <>A tarefa <strong>"{deleteTarget?.label}"</strong> será excluída permanentemente.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
