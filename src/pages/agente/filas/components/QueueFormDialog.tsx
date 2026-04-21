import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Queue, useQueueMutations } from '../hooks/useQueues';
import { useAgentQueueLimits } from '../hooks/useAgentQueueLimits';

interface QueueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue?: Queue | null;
}

export function QueueFormDialog({ open, onOpenChange, queue }: QueueFormDialogProps) {
  const { updateQueue } = useQueueMutations();
  const { data: limits } = useAgentQueueLimits();
  const [name, setName] = useState('');

  useEffect(() => {
    if (queue) {
      setName(queue.name);
    } else {
      setName('');
    }
  }, [queue, open]);

  const isPending = updateQueue.isPending;

  const handleSubmit = () => {
    if (!name.trim() || !queue) return;
    updateQueue.mutate({ queue_id: queue.id, name: name.trim() }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Fila</DialogTitle>
          <DialogDescription>
            Visualize as configurações da fila.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Fila</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Principal" />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div>
              <Label className="text-sm">Aceita grupos</Label>
              <p className="text-xs text-muted-foreground">
                Definido na configuração do agente
              </p>
            </div>
            <span className={`text-sm font-medium ${limits?.allowGroups ? 'text-green-600' : 'text-muted-foreground'}`}>
              {limits?.allowGroups ? '✓ Sim' : '✗ Não'}
            </span>
          </div>

          {queue?.channel_type === 'uazapi' && (
            <>
              <div>
                <Label className="text-muted-foreground">URL da API</Label>
                <Input value={queue.evo_url || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">API Key</Label>
                <Input value={queue.evo_apikey ? '••••••••••••' : ''} disabled type="password" className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Instância</Label>
                <Input value={queue.evo_instance || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            </>
          )}

          {queue?.channel_type === 'waba' && (
            <>
              <div>
                <Label className="text-muted-foreground">WABA ID</Label>
                <Input value={queue.waba_id || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Access Token</Label>
                <Input value={queue.waba_token ? '••••••••••••' : ''} disabled type="password" className="bg-muted/50 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-muted-foreground">Phone Number ID</Label>
                <Input value={queue.waba_number_id || ''} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
