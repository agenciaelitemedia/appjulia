import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import { useAgentSearch, type SearchedAgent } from '@/pages/agents/hooks/useAgentSearch';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { BILLING_PERIOD_LABELS, getPlanPriceByPeriod, type BillingPeriod, type PhonePlan } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PhonePlan[];
}

export function AddTelefoniaDialog({ open, onOpenChange, plans }: Props) {
  const { searchTerm, setSearchTerm, results, isLoading: searching } = useAgentSearch();
  const { assignPlan } = useTelefoniaAdmin();

  const [selectedAgent, setSelectedAgent] = useState<SearchedAgent | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [extraExtensions, setExtraExtensions] = useState(0);

  const selectedPlan = plans.find(p => String(p.id) === selectedPlanId);
  const planPrice = selectedPlan ? getPlanPriceByPeriod(selectedPlan, billingPeriod) : 0;
  const extrasPrice = selectedPlan ? extraExtensions * Number(selectedPlan.extra_extension_price || 0) : 0;
  const totalPrice = planPrice + extrasPrice;

  const handleReset = () => {
    setSelectedAgent(null);
    setSelectedPlanId('');
    setBillingPeriod('monthly');
    setExtraExtensions(0);
    setSearchTerm('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) handleReset();
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (!selectedAgent || !selectedPlan) return;
    assignPlan.mutate({
      codAgent: selectedAgent.cod_agent,
      planId: selectedPlan.id,
      billingPeriod,
      extraExtensions,
      clientName: selectedAgent.client_name,
      businessName: selectedAgent.business_name || '',
    }, {
      onSuccess: () => handleClose(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Telefonia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent search */}
          {!selectedAgent ? (
            <div className="space-y-2">
              <Label>Buscar Agente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Código, nome ou escritório..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              )}
              {results.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {results.map((agent) => (
                    <button
                      key={agent.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{agent.cod_agent}</span>
                      <span className="block text-sm font-medium">{agent.client_name}</span>
                      {agent.business_name && (
                        <span className="block text-xs text-muted-foreground">{agent.business_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{selectedAgent.cod_agent}</span>
                  <span className="block text-sm font-medium">{selectedAgent.client_name}</span>
                  {selectedAgent.business_name && (
                    <span className="block text-xs text-muted-foreground">{selectedAgent.business_name}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>Trocar</Button>
              </div>
            </div>
          )}

          {/* Plan selection */}
          {selectedAgent && (
            <>
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAgent || !selectedPlan || assignPlan.isPending}
          >
            {assignPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
