import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plug, Radio } from 'lucide-react';
import { isUnofficialQueue, useDspQueues } from '../extend/queues';
import { useDspChannelLimits, useDspChannelStates } from '../hooks/useDspMonitor';
import { useToggleDspChannel } from '../hooks/useDspChannels';
import { ChannelLimitsCard } from './ChannelLimitsCard';

export function ChannelsTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: limits = [] } = useDspChannelLimits(clientId);
  const { data: states = [] } = useDspChannelStates(clientId);
  const toggle = useToggleDspChannel();

  const limitByQueue = new Map(limits.map((l) => [l.queue_id, l]));
  const stateByQueue = new Map(states.map((s) => [s.queue_id, s]));

  const enabled = queues.filter((q) => limitByQueue.get(q.id)?.is_enabled === true);
  const available = queues.filter((q) => limitByQueue.get(q.id)?.is_enabled !== true);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar os canais de disparo.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Somente as filas habilitadas aqui podem ser usadas em campanhas. Cada canal tem seus próprios
        limites, delays e peso de rotação — aplicados pelo motor de envio antes de cada mensagem.
      </p>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="h-4 w-4" /> Canais habilitados
          <Badge variant="secondary" className="text-[10px]">{enabled.length}</Badge>
        </h3>
        {enabled.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum canal habilitado. Habilite uma fila abaixo para poder disparar campanhas.
          </p>
        )}
        {enabled.map((q) => (
          <ChannelLimitsCard
            key={q.id}
            queue={q}
            saved={limitByQueue.get(q.id)}
            state={stateByQueue.get(q.id)}
            clientId={String(clientId)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4" /> Filas disponíveis
          <Badge variant="outline" className="text-[10px]">{available.length}</Badge>
        </h3>
        {queues.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fila cadastrada no escritório.</p>}
        {available.map((q) => {
          const unofficial = isUnofficialQueue(q);
          return (
            <Card key={q.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{q.name}</span>
                  {q.phone_number && <span className="text-xs text-muted-foreground">{q.phone_number}</span>}
                  <Badge variant={unofficial ? 'destructive' : 'secondary'} className="text-[10px]">
                    {unofficial ? 'API não oficial' : 'API oficial'}
                  </Badge>
                  {!q.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                </div>
                <Button
                  size="sm" className="gap-2"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ clientId: String(clientId), queue: q, enabled: true })}
                >
                  <Plug className="h-3.5 w-3.5" /> Usar em Disparos
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
