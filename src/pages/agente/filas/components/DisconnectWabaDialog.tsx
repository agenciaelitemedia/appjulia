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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Queue } from '../hooks/useQueues';
import { useQueueMutations } from '../hooks/useQueues';

interface DisconnectWabaDialogProps {
  queue: Queue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisconnectWabaDialog({ queue, open, onOpenChange }: DisconnectWabaDialogProps) {
  const { updateQueue } = useQueueMutations();
  const [confirmText, setConfirmText] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setConfirmSwitch(false);
    }
  }, [open]);

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
          <AlertDialogTitle>Desconectar WABA</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Esta ação irá remover o token, o ID da WABA e o número conectado da fila <strong>{queue.name}</strong>, além de desativá-la.
              Você precisará reconectar via Embedded Signup da Meta para voltar a usar esta fila. Para confirmar, digite o nome da fila abaixo:
            </p>
            <Input
              placeholder={queue.name || 'Nome da fila'}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="confirm-disconnect-waba"
                checked={confirmSwitch}
                onCheckedChange={setConfirmSwitch}
              />
              <Label htmlFor="confirm-disconnect-waba" className="text-sm">
                Confirmo que desejo desconectar esta fila
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={updateQueue.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={confirmText !== queue.name || !confirmSwitch || updateQueue.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {updateQueue.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Desconectar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
