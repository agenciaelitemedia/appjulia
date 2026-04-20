import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Network } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueues } from '@/pages/agente/filas/hooks/useQueues';
import { UserAgent } from '../types';

interface QueueConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onSuccess: () => void;
}

const CHANNEL_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  waba: { label: 'Oficial', variant: 'default' },
  whatsapp_waba: { label: 'Oficial', variant: 'default' },
  uazapi: { label: 'UaZapi', variant: 'secondary' },
  whatsapp_uazapi: { label: 'UaZapi', variant: 'secondary' },
};

function getChannelBadge(channelType: string) {
  return CHANNEL_LABELS[channelType] ?? { label: channelType, variant: 'outline' as const };
}

export function QueueConnectionDialog({ open, onOpenChange, agent, onSuccess }: QueueConnectionDialogProps) {
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: queues = [], isLoading } = useQueues();
  const activeQueues = queues.filter(q => !q.is_deleted && q.is_active);

  const handleConnect = async () => {
    if (!selectedQueueId) return;
    setIsSaving(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('queue-management', {
        body: {
          action: 'link_agent',
          data: {
            queue_id: selectedQueueId,
            cod_agent: agent.cod_agent,
            is_primary: true,
          },
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast.success('Fila vinculada com sucesso');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro ao vincular fila', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar via Fila</DialogTitle>
          <DialogDescription>
            Selecione a fila que receberá as mensagens de{' '}
            <strong>{agent.business_name || agent.client_name || 'este agente'}</strong>.
            As credenciais serão sincronizadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeQueues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Network className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">Nenhuma fila configurada</p>
              <p className="text-xs">Acesse <strong>Configurações &gt; Filas</strong> para criar uma fila.</p>
            </div>
          ) : (
            <RadioGroup value={selectedQueueId} onValueChange={setSelectedQueueId} className="gap-2">
              {activeQueues.map((queue) => {
                const badge = getChannelBadge(queue.channel_type);
                return (
                  <div
                    key={queue.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedQueueId === queue.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedQueueId(queue.id)}
                  >
                    <RadioGroupItem value={queue.id} id={queue.id} />
                    <Label htmlFor={queue.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{queue.name}</span>
                    </Label>
                    <Badge variant={badge.variant} className="text-xs">
                      {badge.label}
                    </Badge>
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleConnect} disabled={!selectedQueueId || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conectando…
              </>
            ) : (
              'Conectar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
