import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQueues, useQueueMutations, Queue } from './hooks/useQueues';
import { QueueCard } from './components/QueueCard';
import { QueueFormDialog } from './components/QueueFormDialog';
import { QueueWizardDialog } from './components/QueueWizardDialog';
import { DeleteQueueDialog } from './components/DeleteQueueDialog';
import { RestoreQueueDialog } from './components/RestoreQueueDialog';
import { useEnsureFilasModule } from '@/hooks/useEnsureFilasModule';
import { useAgentQueueLimits } from './hooks/useAgentQueueLimits';
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

export default function FilasPage() {
  useEnsureFilasModule();
  const navigate = useNavigate();
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: queues = [], isLoading } = useQueues(showDeleted);
  const { data: limits } = useAgentQueueLimits();
  const queueLimit = limits?.queueLimit ?? 1;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Queue | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Queue | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const handleEdit = (queue: Queue) => {
    setEditingQueue(queue);
    setFormOpen(true);
  };

  const handleNew = () => {
    setWizardOpen(true);
  };

  const activeQueues = queues.filter((q) => !q.is_deleted);
  const limitReached = activeQueues.length >= queueLimit;

  const handleNewClick = () => {
    if (limitReached) {
      setLimitDialogOpen(true);
    } else {
      handleNew();
    }
  };

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
            Gerencie as conexões de canais de comunicação · {activeQueues.length} / {queueLimit} filas usadas
          </p>
        </div>
        <Button onClick={handleNewClick}>
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
              onRestore={setRestoreTarget}
            />
          ))}
        </div>
      )}

      <QueueWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

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

      {restoreTarget && (
        <RestoreQueueDialog
          open={!!restoreTarget}
          onOpenChange={(open) => !open && setRestoreTarget(null)}
          queue={restoreTarget}
          activeQueues={activeQueues}
        />
      )}

      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de filas atingido</AlertDialogTitle>
            <AlertDialogDescription>
              Seu plano permite {queueLimit === 1 ? '1 fila' : `${queueLimit} filas`} de atendimento e
              você já está utilizando {activeQueues.length === 1 ? '1 fila' : `${activeQueues.length} filas`}.
              Não há {activeQueues.length === 1 ? 'mais nenhuma fila disponível' : 'nenhuma fila disponível'} no momento.
              Para criar {activeQueues.length === queueLimit && queueLimit === 0 ? 'a primeira fila' : 'uma nova fila'},
              contrate {queueLimit === 0 ? 'um plano' : 'filas adicionais'} clicando no botão abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLimitDialogOpen(false);
                navigate('/filas/contratar');
              }}
            >
              {queueLimit === 0 ? 'Contratar plano' : 'Contratar mais filas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
