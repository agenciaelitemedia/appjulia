import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Save } from 'lucide-react';
import { useDspQueues, isUnofficialQueue } from '../extend/queues';
import { useDspChannelLimits } from '../hooks/useDspMonitor';
import { DSP_OFFICIAL_DEFAULTS, DSP_UNOFFICIAL_DEFAULTS, useSaveDspLimits, validateLimits } from '../hooks/useDspLimits';

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

function QueueLimitsCard({
  queue, saved, clientId,
}: { queue: any; saved: any; clientId: string }) {
  const unofficial = isUnofficialQueue(queue);
  const defaults = unofficial ? DSP_UNOFFICIAL_DEFAULTS : DSP_OFFICIAL_DEFAULTS;
  const save = useSaveDspLimits();

  const [form, setForm] = useState<Form>({ ...defaults } as Form);

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
  }, [saved?.id, queue.id]);

  const errors = validateLimits(form as any, unofficial);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {queue.name}
          <Badge variant={unofficial ? 'destructive' : 'secondary'} className="text-[10px]">
            {unofficial ? 'API não oficial' : 'API oficial'}
          </Badge>
          {!queue.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
            <Input
              type="time" className="h-8"
              value={form.send_window_start ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, send_window_start: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Janela — fim</Label>
            <Input
              type="time" className="h-8"
              value={form.send_window_end ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, send_window_end: e.target.value }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={!!form.marketing_enabled}
            onCheckedChange={(v) => setForm((p) => ({ ...p, marketing_enabled: v }))}
          />
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

        <div className="flex items-center gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { data: queues = [] } = useDspQueues(clientId);
  const { data: limits = [] } = useDspChannelLimits(clientId);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para alterar as configurações de disparo.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estes limites são aplicados pelo motor de envio antes de cada mensagem. Em filas de API não
        oficial, intervalos, blocos e rampa são obrigatórios para reduzir o risco de bloqueio.
      </p>
      {queues.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fila cadastrada.</p>}
      {queues.map((q) => (
        <QueueLimitsCard
          key={q.id}
          queue={q}
          saved={limits.find((l) => l.queue_id === q.id)}
          clientId={String(clientId)}
        />
      ))}
    </div>
  );
}
