import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Phone } from 'lucide-react';
import { type PhonePlan, type BillingPeriod, type ContractDraft, PERIOD_LABELS, calculateTotal, priceForPeriod, setupFeeForPeriod, isAddonsFree, ADDON_PRICE_MONTHLY_REAIS } from '../types';

interface Props {
  draft: ContractDraft;
  onChange: (next: ContractDraft) => void;
  onNext: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SelectPlanStep({ draft, onChange, onNext }: Props) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['telephony-plans-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('phone_extension_plans' as never)
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      return (data ?? []) as unknown as PhonePlan[];
    },
  });

  const totals = calculateTotal(draft);
  const canContinue = !!draft.plan;

  function selectPlan(plan: PhonePlan) {
    onChange({ ...draft, plan });
  }

  function setPeriod(billing_period: BillingPeriod) {
    onChange({ ...draft, billing_period });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Período de cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={draft.billing_period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="monthly">Mensal</TabsTrigger>
                <TabsTrigger value="quarterly">Trimestral</TabsTrigger>
                <TabsTrigger value="semiannual">Semestral</TabsTrigger>
                <TabsTrigger value="annual">Anual</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground col-span-2 mx-auto" />}
          {plans.map((p) => {
            const selected = draft.plan?.id === p.id;
            const price = priceForPeriod(p, draft.billing_period);
            const setupFee = setupFeeForPeriod(p, draft.billing_period);
            return (
              <button
                key={p.id}
                onClick={() => selectPlan(p)}
                className={`text-left rounded-lg border p-4 transition-all ${
                  selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-semibold">{p.name}</div>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {p.max_extensions} ramais inclusos
                  {p.description ? ` · ${p.description}` : ''}
                </div>
                <div className="text-2xl font-bold">{fmt(price)}</div>
                <div className="text-xs text-muted-foreground">no período {PERIOD_LABELS[draft.billing_period].toLowerCase()}</div>
                {setupFee !== null && (
                  setupFee === 0 ? (
                    <Badge className="mt-2 bg-emerald-500 hover:bg-emerald-500 text-white border-0">
                      Setup grátis
                    </Badge>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-2">
                      Taxa de setup: {fmt(setupFee)}
                    </div>
                  )
                )}
                {p.extra_extension_price && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Ramal extra: {fmt(Number(p.extra_extension_price))}/mês
                  </div>
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
                <Label htmlFor="extras">Ramais extras</Label>
                <Input
                  id="extras"
                  type="number" min={0} max={50}
                  value={draft.extra_extensions}
                  onChange={(e) => onChange({ ...draft, extra_extensions: Math.max(0, Number(e.target.value) || 0) })}
                />
                <p className="text-xs text-muted-foreground">
                  Plano inclui {draft.plan.max_extensions} ramais. Adicione mais se precisar.
                </p>
              </div>

              {/* Adicionais ocultos — gravação e transcrição inclusos por padrão */}
              <div className="hidden">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={draft.recording_enabled}
                    onCheckedChange={(v) => onChange({ ...draft, recording_enabled: !!v })}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      Gravação de chamadas
                      {isAddonsFree(draft.billing_period) ? (
                        <Badge variant="secondary" className="text-[10px]">grátis no plano</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">+ {fmt(ADDON_PRICE_MONTHLY_REAIS)}/mês</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">Todas as chamadas ficam gravadas e disponíveis para audição.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={draft.transcription_enabled}
                    onCheckedChange={(v) => onChange({ ...draft, transcription_enabled: !!v })}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      Transcrição & resumo
                      {isAddonsFree(draft.billing_period) ? (
                        <Badge variant="secondary" className="text-[10px]">grátis no plano</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">+ {fmt(ADDON_PRICE_MONTHLY_REAIS)}/mês</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">Cada chamada vira texto + resumo automaticamente.</div>
                  </div>
                </label>
              </div>
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
                return (
                  <Row
                    label="Taxa de setup"
                    value={fee === 0 ? 'Grátis' : fmt(fee)}
                    muted={fee === 0}
                  />
                );
              })()}
              {draft.recording_enabled && (
                <Row
                  label="Gravação de chamadas"
                  value={totals.recording > 0 ? fmt(totals.recording) : 'Grátis'}
                  muted={totals.recording === 0}
                />
              )}
              {draft.transcription_enabled && (
                <Row
                  label="Transcrição & resumo"
                  value={totals.transcription > 0 ? fmt(totals.transcription) : 'Grátis'}
                  muted={totals.transcription === 0}
                />
              )}
              {draft.extra_extensions > 0 && (
                <Row label={`${draft.extra_extensions} ramal(is) extra`} value={fmt(totals.extras)} />
              )}
              <hr />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{fmt(totals.total)}</span>
              </div>
            </>
          )}
          <Button className="w-full mt-4" disabled={!canContinue} onClick={onNext}>
            Continuar
          </Button>
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
