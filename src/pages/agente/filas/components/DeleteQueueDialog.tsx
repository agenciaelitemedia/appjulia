import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertTriangle } from 'lucide-react';
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
  const [confirmName, setConfirmName] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const nameMatches = confirmName.trim().toLowerCase() === queue.name.trim().toLowerCase();
  const canDelete = nameMatches && confirmSwitch;

  const handleDelete = () => {
    if (!canDelete) return;
    deleteQueue.mutate(
      { queue_id: queue.id, migrate_to_queue_id: migrateToId || undefined },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmName('');
      setConfirmSwitch(false);
      setMigrateToId('');
    }
    onOpenChange(isOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Excluir Fila: {queue.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            A fila será desativada (soft delete) e o histórico de conversas será preservado.
            Se houver conversas ativas, selecione uma fila de destino para migração.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <Label>
              Digite <strong className="text-destructive">{queue.name}</strong> para confirmar:
            </Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={queue.name}
            />
          </div>

          <div className="flex items-center gap-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
            <Switch
              checked={confirmSwitch}
              onCheckedChange={setConfirmSwitch}
              disabled={!nameMatches}
            />
            <Label className="text-sm text-foreground cursor-pointer">
              Confirmo que desejo excluir esta fila permanentemente
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || deleteQueue.isPending}>
            {deleteQueue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
