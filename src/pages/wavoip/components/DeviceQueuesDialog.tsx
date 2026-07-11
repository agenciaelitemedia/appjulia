import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import {
  useClientQueuesForLink,
  useDeviceQueueIds,
  useSetDeviceQueues,
} from '../hooks/useWavoipDeviceQueues';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string | null;
  deviceName: string;
  clientId: number | null;
  createdBy?: number | null;
}

export function DeviceQueuesDialog({ open, onOpenChange, deviceId, deviceName, clientId, createdBy }: Props) {
  const { data: queues = [], isLoading: loadingQueues } = useClientQueuesForLink(open ? clientId : null);
  const { data: currentIds = [], isLoading: loadingCurrent } = useDeviceQueueIds(open ? deviceId : null);
  const setDeviceQueues = useSetDeviceQueues();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(currentIds));
  }, [open, currentIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!deviceId || clientId == null) return;
    setDeviceQueues.mutate(
      { deviceId, clientId, queueIds: [...selected], createdBy: createdBy ?? null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const loading = loadingQueues || loadingCurrent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular filas — {deviceName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Ao ligar por Wavoip a partir do chat, o dispositivo vinculado à fila da conversa será pré-selecionado.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : queues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma fila ativa disponível.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {queues.map((q) => {
                const checked = selected.has(q.id);
                return (
                  <label
                    key={q.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(q.id)} />
                    <span className="text-sm">{q.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={setDeviceQueues.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={setDeviceQueues.isPending || !deviceId || clientId == null}>
            {setDeviceQueues.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}