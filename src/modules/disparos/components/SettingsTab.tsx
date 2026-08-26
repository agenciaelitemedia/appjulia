import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';
import { isUnofficialQueue, useDspQueues } from '../extend/queues';
import { useDspChannelLimits } from '../hooks/useDspMonitor';
import { useDspProviderDefaults } from '../hooks/useDspProviderDefaults';
import { ProviderDefaultsCard } from './ProviderDefaultsCard';

export function SettingsTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: limits = [] } = useDspChannelLimits(clientId);
  const { data: defaults = [] } = useDspProviderDefaults(clientId);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para alterar as configurações de disparo.</p>;
  }

  const enabledQueueIds = new Set(limits.filter((l) => l.is_enabled === true).map((l) => l.queue_id));
  const enabledQueues = queues.filter((q) => enabledQueueIds.has(q.id));
  const unofficialCount = enabledQueues.filter((q) => isUnofficialQueue(q)).length;
  const officialCount = enabledQueues.length - unofficialCount;

  const byProvider = new Map(defaults.map((d) => [d.provider, d]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4" /> Padrões seguros por tipo de API
            <Badge variant="secondary" className="text-[10px]">{enabledQueues.length} canal(is) habilitado(s)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure aqui, uma única vez, os limites e delays de cada tipo de API. Todos os canais
          habilitados na aba <b>Canais</b> seguem automaticamente o padrão do seu tipo — lá você só
          define quais filas podem disparar e o peso de rotação.
        </CardContent>
      </Card>

      <ProviderDefaultsCard
        clientId={String(clientId)}
        provider="uazapi"
        saved={byProvider.get('uazapi')}
        channelCount={unofficialCount}
      />

      <ProviderDefaultsCard
        clientId={String(clientId)}
        provider="meta_cloud"
        saved={byProvider.get('meta_cloud')}
        channelCount={officialCount}
      />
    </div>
  );
}
