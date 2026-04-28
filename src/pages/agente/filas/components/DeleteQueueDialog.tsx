import { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

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
  const [forceWithoutMigration, setForceWithoutMigration] = useState(false);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  // Carrega contagem de conversas ativas (não resolvidas/fechadas) na fila
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setActiveCount(null);
    supabase
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('queue_id', queue.id)
      .not('status', 'in', '(resolved,closed)')
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) setActiveCount(0);
        else setActiveCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [open, queue.id]);

  const hasActive = (activeCount ?? 0) > 0;
  const migrationRequired = hasActive && !forceWithoutMigration;
  const migrationOk = !migrationRequired || !!migrateToId;

  const nameMatches = confirmName.trim().toLowerCase() === queue.name.trim().toLowerCase();
  const canDelete = nameMatches && confirmSwitch && migrationOk;

  const handleDelete = () => {
    if (!canDelete) return;
    deleteQueue.mutate(
      {
        queue_id: queue.id,
        migrate_to_queue_id: forceWithoutMigration ? undefined : (migrateToId || undefined),
        force: forceWithoutMigration || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmName('');
      setConfirmSwitch(false);
      setMigrateToId('');
      setForceWithoutMigration(false);
      setActiveCount(null);
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
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {hasActive && (
            <div className="flex items-start gap-2 p-3 border border-amber-300 rounded-lg bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-foreground">
                  {activeCount} conversa{activeCount === 1 ? '' : 's'} ativa{activeCount === 1 ? '' : 's'} nesta fila
                </p>
                <p className="text-muted-foreground">
                  Selecione uma fila de destino abaixo para migrar antes de excluir, ou resolva as conversas primeiro.
                </p>
              </div>
            </div>
          )}

          {hasActive && (
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg bg-muted/30">
              <Switch
                checked={forceWithoutMigration}
                onCheckedChange={setForceWithoutMigration}
              />
              <div className="text-xs">
                <Label className="text-foreground cursor-pointer">
                  Excluir sem migrar conversas
                </Label>
                <p className="text-muted-foreground mt-1">
                  As {activeCount} conversa{activeCount === 1 ? '' : 's'} ficará{activeCount === 1 ? '' : 'ão'} preservada{activeCount === 1 ? '' : 's'} na fila excluída. Você poderá recuperá-las depois restaurando esta fila para outra fila ativa.
                </p>
              </div>
            </div>
          )}

          {(hasActive || otherQueues.length > 0) && !forceWithoutMigration && (
            <div className="space-y-2">
              <Label>
                Migrar conversas ativas para:
                {migrationRequired && <span className="text-destructive ml-1">*</span>}
              </Label>
              {otherQueues.length === 0 ? (
                <p className="text-xs text-destructive">
                  Nenhuma outra fila disponível para migração. Use a opção "Excluir sem migrar" acima ou resolva as conversas ativas primeiro.
                </p>
              ) : (
                <Select value={migrateToId} onValueChange={setMigrateToId}>
                  <SelectTrigger>
                    <SelectValue placeholder={migrationRequired ? 'Selecione a fila de destino' : 'Selecionar fila (opcional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    {otherQueues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
