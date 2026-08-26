import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, ShieldCheck } from 'lucide-react';
import { useDspQueues } from '../extend/queues';
import { useDspChannelLimits } from '../hooks/useDspMonitor';
import { DSP_OFFICIAL_DEFAULTS, DSP_UNOFFICIAL_DEFAULTS } from '../hooks/useDspLimits';

export function SettingsTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: limits = [] } = useDspChannelLimits(clientId);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para alterar as configurações de disparo.</p>;
  }

  const enabledCount = limits.filter((l) => l.is_enabled === true).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4" /> Canais de disparo
            <Badge variant="secondary" className="text-[10px]">{enabledCount} habilitado(s)</Badge>
            <Badge variant="outline" className="text-[10px]">{queues.length} fila(s)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Os limites, delays, janelas de horário e pesos de rotação passaram a ser configurados por
            canal na aba <b>Canais</b>. Uma fila só pode ser usada em campanhas depois de ser habilitada lá.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4" /> Padrões seguros aplicados a novos canais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium">API não oficial (UaZapi)</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              <li>{DSP_UNOFFICIAL_DEFAULTS.max_per_minute}/min · {DSP_UNOFFICIAL_DEFAULTS.max_per_hour}/h · {DSP_UNOFFICIAL_DEFAULTS.max_per_day}/dia</li>
              <li>Intervalo {DSP_UNOFFICIAL_DEFAULTS.min_seconds_between_messages}s–{DSP_UNOFFICIAL_DEFAULTS.max_seconds_between_messages}s entre mensagens</li>
              <li>Bloco de {DSP_UNOFFICIAL_DEFAULTS.block_size} com pausa de {DSP_UNOFFICIAL_DEFAULTS.block_pause_seconds}s</li>
              <li>Rampa diária de {DSP_UNOFFICIAL_DEFAULTS.daily_ramp_percent}%</li>
              <li>Janela {DSP_UNOFFICIAL_DEFAULTS.send_window_start}–{DSP_UNOFFICIAL_DEFAULTS.send_window_end}</li>
            </ul>
          </div>
          <div className="space-y-1">
            <p className="font-medium">API oficial (Meta Cloud)</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              <li>{DSP_OFFICIAL_DEFAULTS.max_per_minute}/min · {DSP_OFFICIAL_DEFAULTS.max_per_hour}/h · {DSP_OFFICIAL_DEFAULTS.max_per_day}/dia</li>
              <li>Intervalo {DSP_OFFICIAL_DEFAULTS.min_seconds_between_messages}s–{DSP_OFFICIAL_DEFAULTS.max_seconds_between_messages}s entre mensagens</li>
              <li>Bloco de {DSP_OFFICIAL_DEFAULTS.block_size} com pausa de {DSP_OFFICIAL_DEFAULTS.block_pause_seconds}s</li>
              <li>Janela {DSP_OFFICIAL_DEFAULTS.send_window_start}–{DSP_OFFICIAL_DEFAULTS.send_window_end}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
