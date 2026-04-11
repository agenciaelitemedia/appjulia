import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Queue, useQueueMutations } from '../hooks/useQueues';

interface DeleteQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: Queue;
  otherQueues: Queue[];
}

export function DeleteQueueDialog({ open, onOpenChange, queue, otherQueues }: DeleteQueueDialogProps) {
  const { deleteQueue } = useQueueMutations();
  const [migrateToId, setMigrateToId] = useState('');

  const handleDelete = () => {
    deleteQueue.mutate(
      { queue_id: queue.id, migrate_to_queue_id: migrateToId || undefined },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Fila: {queue.name}</AlertDialogTitle>
          <AlertDialogDescription>
            A fila será desativada (soft delete) e o histórico de conversas será preservado.
            Se houver conversas ativas, selecione uma fila de destino para migração.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {otherQueues.length > 0 && (
          <div className="space-y-2">
            <Label>Migrar conversas ativas para:</Label>
            <Select value={migrateToId} onValueChange={setMigrateToId}>
              <SelectTrigger><SelectValue placeholder="Selecionar fila (opcional)" /></SelectTrigger>
              <SelectContent>
                {otherQueues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteQueue.isPending}>
            {deleteQueue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
