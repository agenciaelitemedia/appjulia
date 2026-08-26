import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, PowerOff, Save, ShieldCheck, Unlock } from 'lucide-react';
import { isUnofficialQueue, type DspQueueOption } from '../extend/queues';
import {
  DSP_OFFICIAL_DEFAULTS, DSP_UNOFFICIAL_DEFAULTS, useClearChannelCooldown,
  useSaveDspLimits, validateLimits,
} from '../hooks/useDspLimits';
import { CHANNEL_HEALTH_LABEL, useSaveDspChannelWeight, useToggleDspChannel } from '../hooks/useDspChannels';
import type { DspChannelLimits, DspChannelState } from '../types';

interface Form {
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  max_unique_recipients_per_day: number;
  min_seconds_between_messages: number;
  max_seconds_between_messages: number;
  block_size: number;
  block_pause_seconds: number;
  daily_ramp_percent: number;
  max_consecutive_failures: number;
  cooldown_after_disconnect_minutes: number;
  marketing_enabled: boolean;
  send_window_start: string;
  send_window_end: string;
}

const NUMERIC_FIELDS: { key: keyof Form; label: string; hint?: string }[] = [
  { key: 'max_per_minute', label: 'Máx. por minuto' },
  { key: 'max_per_hour', label: 'Máx. por hora' },
  { key: 'max_per_day', label: 'Máx. por dia' },
  { key: 'max_unique_recipients_per_day', label: 'Destinatários únicos / dia' },
  { key: 'min_seconds_between_messages', label: 'Intervalo mínimo (s)', hint: 'Espera entre mensagens' },
  { key: 'max_seconds_between_messages', label: 'Intervalo máximo (s)', hint: 'Sorteio aleatório (jitter)' },
  { key: 'block_size', label: 'Tamanho do bloco', hint: 'Mensagens antes da pausa longa' },
  { key: 'block_pause_seconds', label: 'Pausa entre blocos (s)' },
  { key: 'daily_ramp_percent', label: 'Rampa diária (%)', hint: 'Crescimento máximo por dia' },
  { key: 'max_consecutive_failures', label: 'Falhas seguidas p/ bloquear' },
  { key: 'cooldown_after_disconnect_minutes', label: 'Cooldown após desconexão (min)' },
];

export function ChannelLimitsCard({
  queue, saved, state, clientId,
}: {
  queue: DspQueueOption;
  saved?: DspChannelLimits | null;
  state?: DspChannelState | null;
  clientId: string;
}) {
  const unofficial = isUnofficialQueue(queue);
  const defaults = unofficial ? DSP_UNOFFICIAL_DEFAULTS : DSP_OFFICIAL_DEFAULTS;
  const save = useSaveDspLimits();
  const saveWeight = useSaveDspChannelWeight();
  const toggle = useToggleDspChannel();
  const clearCooldown = useClearChannelCooldown();

  const [form, setForm] = useState<Form>({ ...defaults } as Form);
  const [weight, setWeight] = useState<number>(Number(saved?.default_weight ?? 1));

  useEffect(() => {
    setForm({
      ...(defaults as Form),
      ...(saved
        ? {
            ...saved,
            send_window_start: (saved.send_window_start ?? defaults.send_window_start)?.slice(0, 5),
            send_window_end: (saved.send_window_end ?? defaults.send_window_end)?.slice(0, 5),
          }
        : {}),
    } as Form);
    setWeight(Number(saved?.default_weight ?? 1));
  }, [saved?.id, queue.id]);

  const errors = validateLimits(form as any, unofficial);
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

        {unofficial && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-destructive" />
            <span>
              API não oficial: mantenha ao menos 5s entre mensagens, pausa de bloco de 30s ou mais e
              limites de até 10/min e 1000/dia para reduzir risco de bloqueio do número.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {NUMERIC_FIELDS.map((f) => (
            <div key={String(f.key)} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                className="h-8"
                value={String(form[f.key] ?? '')}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
              />
              {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Janela — início</Label>
            <Input type="time" className="h-8" value={form.send_window_start ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, send_window_start: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Janela — fim</Label>
            <Input type="time" className="h-8" value={form.send_window_end ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, send_window_end: e.target.value }))} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!form.marketing_enabled}
            onCheckedChange={(v) => setForm((p) => ({ ...p, marketing_enabled: v }))} />
          Permitir campanhas de marketing nesta fila
        </label>

        {errors.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            {errors.map((e) => (
              <div key={e} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />{e}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm" className="gap-2"
            disabled={errors.length > 0 || save.isPending}
            onClick={() =>
              save.mutate({
                ...(form as any),
                client_id: clientId,
                queue_id: queue.id,
                provider: unofficial ? 'uazapi' : 'meta_cloud',
                unofficial,
              })
            }
          >
            <Save className="h-3.5 w-3.5" /> Salvar limites
          </Button>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...defaults } as Form)}>
            Restaurar padrão seguro
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-destructive"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ clientId, queue, enabled: false })}>
            <PowerOff className="h-3.5 w-3.5" /> Remover dos disparos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
