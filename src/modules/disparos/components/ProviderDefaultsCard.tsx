import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { validateLimits } from '../hooks/useDspLimits';
import {
  providerFallback, useSaveDspProviderDefaults, type DspProvider,
} from '../hooks/useDspProviderDefaults';
import type { DspProviderDefaults } from '../types';

const NUMERIC_FIELDS: { key: string; label: string; hint?: string }[] = [
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

export function ProviderDefaultsCard({
  clientId, provider, saved, channelCount,
}: {
  clientId: string;
  provider: DspProvider;
  saved?: DspProviderDefaults | null;
  channelCount: number;
}) {
  const unofficial = provider === 'uazapi';
  const fallback = providerFallback(provider);
  const save = useSaveDspProviderDefaults();

  const [form, setForm] = useState<any>({ ...fallback });

  useEffect(() => {
    setForm({
      ...fallback,
      ...(saved ?? {}),
      send_window_start: (saved?.send_window_start ?? fallback.send_window_start)?.slice(0, 5),
      send_window_end: (saved?.send_window_end ?? fallback.send_window_end)?.slice(0, 5),
    });
  }, [saved?.id, provider]);

  const errors = validateLimits(form, unofficial);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4" />
          {unofficial ? 'API não oficial (UaZapi)' : 'API oficial (Meta Cloud)'}
          <Badge variant={unofficial ? 'destructive' : 'secondary'} className="text-[10px]">
            {channelCount} canal(is) usando
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Estes limites valem para <b>todos</b> os canais deste tipo habilitados em Disparos. Não há
          configuração por canal — ao salvar aqui, o motor de envio passa a usar os novos valores.
        </p>

        {unofficial && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-destructive" />
            <span>
              Mantenha ao menos 5s entre mensagens, pausa de bloco de 30s ou mais e limites de até
              10/min e 1000/dia para reduzir risco de bloqueio do número.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                className="h-8"
                value={String(form[f.key] ?? '')}
                onChange={(e) => setForm((p: any) => ({ ...p, [f.key]: Number(e.target.value) }))}
              />
              {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Janela — início</Label>
            <Input type="time" className="h-8" value={form.send_window_start ?? ''}
              onChange={(e) => setForm((p: any) => ({ ...p, send_window_start: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Janela — fim</Label>
            <Input type="time" className="h-8" value={form.send_window_end ?? ''}
              onChange={(e) => setForm((p: any) => ({ ...p, send_window_end: e.target.value }))} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!form.marketing_enabled}
            onCheckedChange={(v) => setForm((p: any) => ({ ...p, marketing_enabled: v }))} />
          Permitir campanhas de marketing neste tipo de API
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
            onClick={() => {
              const { id, created_at, updated_at, ...row } = form;
              save.mutate({ ...row, client_id: clientId, provider });
            }}
          >
            <Save className="h-3.5 w-3.5" /> Salvar padrão
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setForm({ ...fallback })}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão seguro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
