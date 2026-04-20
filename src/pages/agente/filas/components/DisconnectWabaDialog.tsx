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
import { Queue } from '../hooks/useQueues';
import { useQueueMutations } from '../hooks/useQueues';

interface DisconnectWabaDialogProps {
  queue: Queue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisconnectWabaDialog({ queue, open, onOpenChange }: DisconnectWabaDialogProps) {
  const { updateQueue } = useQueueMutations();

  const handleConfirm = async () => {
    await updateQueue.mutateAsync({
      queue_id: queue.id,
      waba_token: null as unknown as string,
      waba_id: null as unknown as string,
      waba_number_id: null as unknown as string,
      // @ts-expect-error - is_active is supported by the update action
      is_active: false,
    });
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar fila WABA?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso vai remover o token, o ID da WABA e o número conectado da fila <strong>{queue.name}</strong>, além de desativá-la.
            Você precisará reconectar via Embedded Signup da Meta para voltar a usar esta fila.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={updateQueue.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={updateQueue.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {updateQueue.isPending ? 'Desconectando...' : 'Desconectar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
