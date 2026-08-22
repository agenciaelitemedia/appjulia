/**
 * Limites e custos do X-Julia (FinOps) — teto de custo diário/mensal, limite de
 * mensagens por hora, ação ao romper o limite e sessões pausadas pelo disjuntor.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, PlayCircle, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { XJLayout } from '../components/XJLayout';
import { useXJUsage, useXJUsageMutations, type XJUsageLimits } from '../hooks/useXJUsageLimits';

const DEFAULTS: Omit<XJUsageLimits, 'client_id'> = {
  daily_cost_usd: 5,
  monthly_cost_usd: 100,
  max_msgs_per_hour_per_lead: 30,
  max_msgs_per_hour_per_client: 300,
  on_breach: 'notify_only',
  breach_message:
    'Estamos com um volume alto de atendimentos neste momento. Um de nossos atendentes vai continuar com você em breve.',
  is_active: true,
};

const usd = (v: number) => `US$ ${Number(v ?? 0).toFixed(4)}`;

export default function XJLimitsPage() {
  const { data, isLoading } = useXJUsage();
  const { saveLimits, resumeSession } = useXJUsageMutations();
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (data?.limits) {
      const { client_id: _ignored, ...rest } = data.limits;
      setForm({ ...DEFAULTS, ...rest });
    }
  }, [data?.limits]);

  const dayCost = Number(data?.usage?.day_cost_usd ?? 0);
  const monthCost = Number(data?.usage?.month_cost_usd ?? 0);
  const dayPct = form.daily_cost_usd > 0 ? Math.min(100, (dayCost / form.daily_cost_usd) * 100) : 0;
  const monthPct = form.monthly_cost_usd > 0 ? Math.min(100, (monthCost / form.monthly_cost_usd) * 100) : 0;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <XJLayout
      title="Limites e custos"
      description="Teto de gasto com IA, limite de mensagens por hora e sessões pausadas pelo disjuntor"
    >
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Custo de hoje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">{usd(dayCost)}</div>
                <Progress value={dayPct} />
                <p className="text-xs text-muted-foreground">
                  Teto do dia: {usd(form.daily_cost_usd)} · {data?.usage?.day_turns ?? 0} turnos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Custo do mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">{usd(monthCost)}</div>
                <Progress value={monthPct} />
                <p className="text-xs text-muted-foreground">
                  Teto do mês: {usd(form.monthly_cost_usd)} · {data?.usage?.month_turns ?? 0} turnos
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Limites do escritório</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="xj-limits-active" className="text-xs text-muted-foreground">
                  Limites ativos
                </Label>
                <Switch
                  id="xj-limits-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => set('is_active', v)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Teto de custo por dia (US$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.daily_cost_usd}
                    onChange={(e) => set('daily_cost_usd', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Teto de custo por mês (US$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monthly_cost_usd}
                    onChange={(e) => set('monthly_cost_usd', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensagens por hora, por lead</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_msgs_per_hour_per_lead}
                    onChange={(e) => set('max_msgs_per_hour_per_lead', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensagens por hora, no escritório</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_msgs_per_hour_per_client}
                    onChange={(e) => set('max_msgs_per_hour_per_client', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ao romper o limite</Label>
                  <Select
                    value={form.on_breach}
                    onValueChange={(v) => set('on_breach', v as XJUsageLimits['on_breach'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify_only">Apenas registrar (continua atendendo)</SelectItem>
                      <SelectItem value="pause">Pausar o atendimento do agente</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Zero em qualquer campo significa "sem limite".
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem enviada ao lead ao pausar</Label>
                <Textarea
                  rows={3}
                  value={form.breach_message}
                  onChange={(e) => set('breach_message', e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveLimits.mutate(form)} disabled={saveLimits.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar limites
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Atendimentos pausados por limite
                <Badge variant="secondary">{data?.paused_sessions?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.paused_sessions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento pausado por limite.</p>
              ) : (
                (data?.paused_sessions ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.contact_name || s.contact_phone || s.id}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.paused_reason || 'sem motivo registrado'}
                        {s.paused_at ? ` · ${new Date(s.paused_at).toLocaleString('pt-BR')}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeSession.mutate(s.id)}
                      disabled={resumeSession.isPending}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Retomar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </XJLayout>
  );
}
