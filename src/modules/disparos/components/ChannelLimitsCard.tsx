import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PowerOff, ShieldCheck, Unlock } from 'lucide-react';
import { isUnofficialQueue, type DspQueueOption } from '../extend/queues';
import { useClearChannelCooldown } from '../hooks/useDspLimits';
import { CHANNEL_HEALTH_LABEL, useSaveDspChannelWeight, useToggleDspChannel } from '../hooks/useDspChannels';
import { providerFallback, useDspProviderDefaults } from '../hooks/useDspProviderDefaults';
import type { DspChannelLimits, DspChannelState } from '../types';

export function ChannelLimitsCard({
  queue, saved, state, clientId,
}: {
  queue: DspQueueOption;
  saved?: DspChannelLimits | null;
  state?: DspChannelState | null;
  clientId: string;
}) {
  const unofficial = isUnofficialQueue(queue);
  const provider = unofficial ? 'uazapi' : 'meta_cloud';
  const saveWeight = useSaveDspChannelWeight();
  const toggle = useToggleDspChannel();
  const clearCooldown = useClearChannelCooldown();
  const { data: providerDefaults = [] } = useDspProviderDefaults(clientId);

  const profile: any = providerDefaults.find((d) => d.provider === provider) ?? providerFallback(provider);

  const [weight, setWeight] = useState<number>(Number(saved?.default_weight ?? 1));
  useEffect(() => setWeight(Number(saved?.default_weight ?? 1)), [saved?.id, queue.id]);

  const inCooldown = !!state?.cooldown_until && new Date(state.cooldown_until) > new Date();
  const health = inCooldown ? 'Em cooldown' : (CHANNEL_HEALTH_LABEL[String(state?.health_status ?? 'healthy')] ?? 'Saudável');

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {queue.name}
          {queue.phone_number && <span className="text-xs font-normal text-muted-foreground">{queue.phone_number}</span>}
          <Badge variant={unofficial ? 'destructive' : 'secondary'} className="text-[10px]">
            {unofficial ? 'API não oficial' : 'API oficial'}
          </Badge>
          {!queue.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
          <Badge variant={inCooldown || state?.health_status === 'blocked' ? 'destructive' : 'outline'} className="text-[10px]">
            {health}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-2 text-xs">
          <span>Hoje: <b>{state?.sent_in_day ?? 0}</b></span>
          <span>Hora: <b>{state?.sent_in_hour ?? 0}</b></span>
          <span>Minuto: <b>{state?.sent_in_minute ?? 0}</b></span>
          <span>Falhas seguidas: <b>{state?.consecutive_failures ?? 0}</b></span>
          {inCooldown && (
            <Button size="sm" variant="outline" className="h-7 gap-1"
              onClick={() => clearCooldown.mutate(queue.id)}>
              <Unlock className="h-3 w-3" /> Liberar canal
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso de rotação</Label>
            <Input type="number" min={1} max={100} className="h-8 w-24"
              value={String(weight)} onChange={(e) => setWeight(Number(e.target.value))} />
          </div>
          <Button size="sm" variant="outline" className="h-8"
            disabled={saveWeight.isPending}
            onClick={() => saveWeight.mutate({ queueId: queue.id, weight })}>
            Salvar peso
          </Button>
          <p className="text-[10px] text-muted-foreground">Peso maior recebe mais mensagens na rotação.</p>
        </div>

        <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
          <p className="flex items-center gap-1 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Padrão seguro aplicado ({unofficial ? 'API não oficial' : 'API oficial'})
          </p>
          <p className="text-muted-foreground">
            {profile.max_per_minute}/min · {profile.max_per_hour}/h · {profile.max_per_day}/dia ·
            intervalo {profile.min_seconds_between_messages}s–{profile.max_seconds_between_messages}s ·
            bloco de {profile.block_size} com pausa de {profile.block_pause_seconds}s ·
            rampa {profile.daily_ramp_percent}% ·
            janela {String(profile.send_window_start ?? '').slice(0, 5)}–{String(profile.send_window_end ?? '').slice(0, 5)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Para alterar, use a aba Configurações — vale para todos os canais deste tipo.
          </p>
        </div>

        <Button size="sm" variant="ghost" className="gap-1 text-destructive"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ clientId, queue, enabled: false })}>
          <PowerOff className="h-3.5 w-3.5" /> Remover dos disparos
        </Button>
      </CardContent>
    </Card>
  );
}
