import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { BILLING_PERIOD_LABELS, getPlanPriceByPeriod, type BillingPeriod, type PhonePlan, type PhoneUserPlan } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PhonePlan[];
  userPlan: PhoneUserPlan | null;
}

export function EditTelefoniaDialog({ open, onOpenChange, plans, userPlan }: Props) {
  const { updateUserPlan } = useTelefoniaAdmin();

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [extraExtensions, setExtraExtensions] = useState(0);
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (userPlan) {
      setSelectedPlanId(String(userPlan.plan_id));
      setBillingPeriod(userPlan.billing_period as BillingPeriod);
      setExtraExtensions(userPlan.extra_extensions || 0);
      setStartDate(userPlan.start_date || '');
    }
  }, [userPlan]);

  const selectedPlan = plans.find(p => String(p.id) === selectedPlanId);
  const planPrice = selectedPlan ? getPlanPriceByPeriod(selectedPlan, billingPeriod) : 0;
  const extrasPrice = selectedPlan ? extraExtensions * Number(selectedPlan.extra_extension_price || 0) : 0;
  const totalPrice = planPrice + extrasPrice;

  const handleConfirm = () => {
    if (!userPlan || !selectedPlan) return;
    updateUserPlan.mutate({
      id: userPlan.id,
      planId: selectedPlan.id,
      billingPeriod,
      extraExtensions,
      startDate,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!userPlan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Telefonia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent info (read-only) */}
          <div className="p-3 border rounded-md bg-muted/30">
            <span className="font-mono text-xs text-muted-foreground">{userPlan.cod_agent}</span>
            <span className="block text-sm font-medium">{userPlan.client_name || '-'}</span>
            {userPlan.business_name && (
              <span className="block text-xs text-muted-foreground">{userPlan.business_name}</span>
            )}
          </div>

          <div>
            <Label>Plano</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.max_extensions} ramais)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Período</Label>
            <Select value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as BillingPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(BILLING_PERIOD_LABELS) as [BillingPeriod, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                    {selectedPlan && ` — R$ ${getPlanPriceByPeriod(selectedPlan, value).toFixed(2)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ramais Extras</Label>
            <Input
              type="number"
              min={0}
              value={extraExtensions}
              onChange={(e) => setExtraExtensions(Math.max(0, Number(e.target.value)))}
            />
            {selectedPlan && selectedPlan.extra_extension_price > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                R$ {Number(selectedPlan.extra_extension_price).toFixed(2)} por ramal extra
              </p>
            )}
          </div>

          <div>
            <Label>Data de Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="p-3 border rounded-md bg-muted/20 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Plano ({BILLING_PERIOD_LABELS[billingPeriod]})</span>
                <span>R$ {planPrice.toFixed(2)}</span>
              </div>
              {extraExtensions > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{extraExtensions} ramal(is) extra(s)</span>
                  <span>R$ {extrasPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Total</span>
                <span>R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlan || updateUserPlan.isPending}
          >
            {updateUserPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
