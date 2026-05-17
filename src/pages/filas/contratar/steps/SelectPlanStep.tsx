import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, MessageSquare } from 'lucide-react';
import { type QueuePlan, type BillingPeriod, type ContractDraft, PERIOD_LABELS, calculateTotal, priceForPeriod, setupFeeForPeriod } from '../types';

interface Props {
  draft: ContractDraft;
  onChange: (next: ContractDraft) => void;
  onNext: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SelectPlanStep({ draft, onChange, onNext }: Props) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['queue-plans-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('queue_plans' as never)
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      return (data ?? []) as unknown as QueuePlan[];
    },
  });

  const totals = calculateTotal(draft);
  const canContinue = !!draft.plan;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Período de cobrança</CardTitle>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground col-span-2 mx-auto" />}
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
                  {p.max_queues} filas inclusas
                  {p.description ? ` · ${p.description}` : ''}
                </div>
                <div className="text-2xl font-bold">{fmt(price)}</div>
                <div className="text-xs text-muted-foreground">no período {PERIOD_LABELS[draft.billing_period].toLowerCase()}</div>
                {setupFee !== null && (
                  setupFee === 0 ? (
                    <Badge className="mt-2 bg-emerald-500 hover:bg-emerald-500 text-white border-0">Setup grátis</Badge>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-2">Taxa de setup: {fmt(setupFee)}</div>
                  )
                )}
                {p.extra_queue_price ? (
                  <div className="text-xs text-muted-foreground mt-2">
                    Fila extra: {fmt(Number(p.extra_queue_price))}/mês
                  </div>
                ) : null}
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
                <Label htmlFor="extras">Filas extras</Label>
                <Input
                  id="extras"
                  type="number" min={0} max={50}
                  value={draft.extra_queues}
                  onChange={(e) => onChange({ ...draft, extra_queues: Math.max(0, Number(e.target.value) || 0) })}
                />
                <p className="text-xs text-muted-foreground">
                  Plano inclui {draft.plan.max_queues} filas. Adicione mais se precisar.
                </p>
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
                  <Row label="Taxa de setup" value={fee === 0 ? 'Grátis' : fmt(fee)} muted={fee === 0} />
                );
              })()}
              {draft.extra_queues > 0 && (
                <Row label={`${draft.extra_queues} fila(s) extra`} value={fmt(totals.extras)} />
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