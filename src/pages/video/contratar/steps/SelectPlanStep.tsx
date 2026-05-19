import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Video } from 'lucide-react';
import {
  type VideoPlan, type BillingPeriod, type ContractDraft,
  PERIOD_LABELS, calculateTotal, priceForPeriod, setupFeeForPeriod, isAddonsFree,
} from '../types';

interface Props {
  draft: ContractDraft;
  onChange: (next: ContractDraft) => void;
  onNext: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMin = (m: number) => `${m.toLocaleString('pt-BR')} min`;

export function SelectPlanStep({ draft, onChange, onNext }: Props) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['video-plans-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('video_plans' as never)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      return (data ?? []) as unknown as VideoPlan[];
    },
  });

  const totals = calculateTotal(draft);
  const canContinue = !!draft.plan;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" /> Período de cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={draft.billing_period} onValueChange={(v) => onChange({ ...draft, billing_period: v as BillingPeriod })}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="monthly">Mensal</TabsTrigger>
                <TabsTrigger value="quarterly">Trimestral</TabsTrigger>
                <TabsTrigger value="semiannual">Semestral</TabsTrigger>
                <TabsTrigger value="annual">Anual</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground col-span-3 mx-auto" />}
          {plans.map((p) => {
            const selected = draft.plan?.id === p.id;
            const price = priceForPeriod(p, draft.billing_period);
            const setupFee = setupFeeForPeriod(p, draft.billing_period);
            return (
              <button
                key={p.id}
                onClick={() => onChange({ ...draft, plan: p })}
                className={`text-left rounded-lg border p-4 transition-all ${
                  selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-semibold">{p.name}</div>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {fmtMin(p.included_minutes)} / mês · {p.max_concurrent_rooms} salas simult.
                </div>
                <div className="text-2xl font-bold">{fmt(price)}</div>
                <div className="text-xs text-muted-foreground">no período {PERIOD_LABELS[draft.billing_period].toLowerCase()}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.recording_included && <Badge variant="secondary" className="text-[10px]">Gravação inclusa</Badge>}
                  {p.transcription_included && <Badge variant="secondary" className="text-[10px]">Transcrição inclusa</Badge>}
                </div>
                {setupFee !== null && (
                  setupFee === 0 ? (
                    <Badge className="mt-2 bg-emerald-500 hover:bg-emerald-500 text-white border-0">Setup grátis</Badge>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-2">Taxa de setup: {fmt(setupFee)}</div>
                  )
                )}
                {p.extra_minutes_pack_price > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Pacote extra: {fmt(Number(p.extra_minutes_pack_price))} / {p.extra_minutes_pack_size.toLocaleString('pt-BR')} min
                  </div>
                )}
                {p.description && (
                  <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{p.description}</div>
                )}
              </button>
            );
          })}
        </div>

        {draft.plan && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalizar contratação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="extras">Pacotes extras de minutos</Label>
                <Input
                  id="extras"
                  type="number" min={0} max={100}
                  value={draft.extra_minute_packs}
                  onChange={(e) => onChange({ ...draft, extra_minute_packs: Math.max(0, Number(e.target.value) || 0) })}
                />
                <p className="text-xs text-muted-foreground">
                  Cada pacote = {draft.plan.extra_minutes_pack_size.toLocaleString('pt-BR')} min/mês por {fmt(Number(draft.plan.extra_minutes_pack_price))}.
                </p>
              </div>

              {!draft.plan.recording_included && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={draft.recording_enabled}
                    onCheckedChange={(v) => onChange({ ...draft, recording_enabled: !!v })}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      Gravação de chamadas
                      {isAddonsFree(draft.billing_period) ? (
                        <Badge variant="secondary" className="text-[10px]">grátis no período</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">+ {fmt(Number(draft.plan.recording_addon_price ?? 99.9))}/mês</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">Todas as videochamadas ficam gravadas e disponíveis para revisão.</div>
                  </div>
                </label>
              )}

              {!draft.plan.transcription_included && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={draft.transcription_enabled}
                    onCheckedChange={(v) => onChange({ ...draft, transcription_enabled: !!v })}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      Transcrição & resumo
                      {isAddonsFree(draft.billing_period) ? (
                        <Badge variant="secondary" className="text-[10px]">grátis no período</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">+ {fmt(Number(draft.plan.transcription_addon_price ?? 99.9))}/mês</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">Cada chamada vira texto + resumo automaticamente.</div>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit sticky top-4">
        <CardHeader>
          <CardTitle className="text-base">Resumo do pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!draft.plan ? (
            <div className="text-muted-foreground">Selecione um plano para ver o resumo</div>
          ) : (
            <>
              <Row label={`${draft.plan.name} (${PERIOD_LABELS[draft.billing_period]})`} value={fmt(totals.plan)} />
              {(() => {
                const fee = setupFeeForPeriod(draft.plan, draft.billing_period);
                if (fee === null) return null;
                return <Row label="Taxa de setup" value={fee === 0 ? 'Grátis' : fmt(fee)} muted={fee === 0} />;
              })()}
              {draft.recording_enabled && !draft.plan.recording_included && (
                <Row label="Gravação" value={totals.recording > 0 ? fmt(totals.recording) : 'Grátis'} muted={totals.recording === 0} />
              )}
              {draft.transcription_enabled && !draft.plan.transcription_included && (
                <Row label="Transcrição & resumo" value={totals.transcription > 0 ? fmt(totals.transcription) : 'Grátis'} muted={totals.transcription === 0} />
              )}
              {draft.extra_minute_packs > 0 && (
                <Row label={`${draft.extra_minute_packs} pacote(s) extra`} value={fmt(totals.extras)} />
              )}
              <hr />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{fmt(totals.total)}</span>
              </div>
            </>
          )}
          <Button className="w-full mt-4" disabled={!canContinue} onClick={onNext}>Continuar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}