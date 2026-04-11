import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQueues, useQueueMutations, Queue } from './hooks/useQueues';
import { QueueCard } from './components/QueueCard';
import { QueueFormDialog } from './components/QueueFormDialog';
import { DeleteQueueDialog } from './components/DeleteQueueDialog';
import { ManageAgentsDialog } from './components/ManageAgentsDialog';

export default function FilasPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: queues = [], isLoading } = useQueues(showDeleted);
  const { restoreQueue } = useQueueMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null);
  const [manageAgentsTarget, setManageAgentsTarget] = useState<Queue | null>(null);

  const handleEdit = (queue: Queue) => {
    setEditingQueue(queue);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingQueue(null);
    setFormOpen(true);
  };

  const activeQueues = queues.filter((q) => !q.is_deleted);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Filas de Atendimento</h1>
          <p className="text-muted-foreground">
            Gerencie as conexões de canais de comunicação
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> Nova Fila
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
        <Label htmlFor="show-deleted" className="text-sm text-muted-foreground">Mostrar excluídas</Label>
      </div>

      {queues.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          <p className="mb-2">Nenhuma fila configurada</p>
          <p className="text-sm">Crie uma fila para começar a receber mensagens</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <QueueCard
              key={queue.id}
              queue={queue}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onRestore={(q) => restoreQueue.mutate(q.id)}
              onManageAgents={setManageAgentsTarget}
            />
          ))}
        </div>
      )}

      <QueueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        queue={editingQueue}
      />

      {deleteTarget && (
        <DeleteQueueDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          queue={deleteTarget}
          otherQueues={activeQueues.filter((q) => q.id !== deleteTarget.id)}
        />
      )}

      {manageAgentsTarget && (
        <ManageAgentsDialog
          open={!!manageAgentsTarget}
          onOpenChange={(open) => !open && setManageAgentsTarget(null)}
          queue={manageAgentsTarget}
        />
      )}
    </div>
  );
}
