import { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RotateCcw } from 'lucide-react';
import { Queue, useQueueMutations } from '../hooks/useQueues';
import { supabase } from '@/integrations/supabase/client';

interface RestoreQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: Queue;
  activeQueues: Queue[];
}

type Mode = 'reactivate' | 'migrate';

export function RestoreQueueDialog({ open, onOpenChange, queue, activeQueues }: RestoreQueueDialogProps) {
  const { restoreQueue } = useQueueMutations();
  const [mode, setMode] = useState<Mode>('reactivate');
  const [destinationId, setDestinationId] = useState('');
  const [convCount, setConvCount] = useState<number | null>(null);
  const [msgCount, setMsgCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConvCount(null);
    setMsgCount(null);
    Promise.all([
      supabase.from('chat_conversations').select('id', { count: 'exact', head: true }).eq('queue_id', queue.id),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('queue_id', queue.id),
    ]).then(([c, m]) => {
      if (cancelled) return;
      setConvCount(c.count ?? 0);
      setMsgCount(m.count ?? 0);
    });
    return () => { cancelled = true; };
  }, [open, queue.id]);

  const canConfirm = mode === 'reactivate' || (mode === 'migrate' && !!destinationId);

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (mode === 'migrate') {
      restoreQueue.mutate(
        { queue_id: queue.id, migrate_to_queue_id: destinationId },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      restoreQueue.mutate(queue.id, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMode('reactivate');
      setDestinationId('');
      setConvCount(null);
      setMsgCount(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            Restaurar fila: {queue.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta fila está excluída. Escolha como deseja recuperá-la.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
            Dados preservados nesta fila:{' '}
            <strong className="text-foreground">
              {convCount ?? '...'} conversa{convCount === 1 ? '' : 's'}
            </strong>{' '}
            ·{' '}
            <strong className="text-foreground">
              {msgCount ?? '...'} mensage{msgCount === 1 ? 'm' : 'ns'}
            </strong>
          </div>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-3">
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <RadioGroupItem value="reactivate" id="r-reactivate" className="mt-0.5" />
              <Label htmlFor="r-reactivate" className="flex-1 cursor-pointer font-normal">
                <div className="font-medium text-foreground">Reativar a fila original</div>
                <p className="text-xs text-muted-foreground mt-1">
                  A fila volta ao estado ativo com todos os seus dados.
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <RadioGroupItem value="migrate" id="r-migrate" className="mt-0.5" />
              <Label htmlFor="r-migrate" className="flex-1 cursor-pointer font-normal">
                <div className="font-medium text-foreground">Restaurar dados em outra fila</div>
                <p className="text-xs text-muted-foreground mt-1">
                  As conversas e mensagens são movidas para uma fila ativa. Esta fila permanece marcada como excluída.
                </p>
              </Label>
            </div>
          </RadioGroup>

          {mode === 'migrate' && (
            <div className="space-y-2 pl-2">
              <Label>Fila de destino *</Label>
              {activeQueues.length === 0 ? (
                <p className="text-xs text-destructive">
                  Nenhuma fila ativa disponível. Crie uma fila ativa antes de migrar.
                </p>
              ) : (
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fila de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeQueues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || restoreQueue.isPending}>
            {restoreQueue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}