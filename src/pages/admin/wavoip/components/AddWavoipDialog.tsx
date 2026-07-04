import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { useClientSearch, type SearchedClient } from '@/pages/admin/telefonia/hooks/useClientSearch';
import { useActivateWavoipForUser, useWavoipPlans, type WavoipPlan } from '../hooks/useWavoipAdmin';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddWavoipDialog({ open, onOpenChange }: Props) {
  const { searchTerm, setSearchTerm, results, isLoading: searching } = useClientSearch();
  const { data: plans = [] } = useWavoipPlans();
  const activate = useActivateWavoipForUser();

  const [selectedClient, setSelectedClient] = useState<SearchedClient | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [extraDevices, setExtraDevices] = useState(0);
  const [deviceNames, setDeviceNames] = useState<string[]>([]);

  const activePlans = plans.filter((p: WavoipPlan) => p.active);
  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId);
  const totalDeviceSlots = (selectedPlan?.max_devices ?? 0) + extraDevices;

  useEffect(() => {
    setDeviceNames((prev) => {
      const next = [...prev];
      if (next.length < totalDeviceSlots) {
        while (next.length < totalDeviceSlots) next.push('');
      } else if (next.length > totalDeviceSlots) {
        next.length = totalDeviceSlots;
      }
      return next;
    });
  }, [totalDeviceSlots]);

  const reset = () => {
    setSelectedClient(null);
    setSelectedPlanId('');
    setExtraDevices(0);
    setDeviceNames([]);
    setSearchTerm('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const setNameAt = (i: number, v: string) =>
    setDeviceNames((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  const allNamesFilled = deviceNames.length === totalDeviceSlots && deviceNames.every((n) => n.trim().length > 0);

  const handleConfirm = () => {
    if (!selectedClient || !selectedPlan) return;
    activate.mutate({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      business_name: selectedClient.business_name,
      plan_id: selectedPlan.id,
      extra_devices: extraDevices,
      billing_period: 'monthly',
      device_names: deviceNames.map((n) => n.trim()),
    }, { onSuccess: () => handleClose(false) });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ativar Wavoip para cliente</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {!selectedClient ? (
            <div className="space-y-2">
              <Label>Buscar Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Nome, escritório ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              )}
              {results.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {results.map((c) => (
                    <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0" onClick={() => setSelectedClient(c)}>
                      <span className="font-mono text-xs text-muted-foreground">#{c.id}</span>
                      <span className="block text-sm font-medium">{c.name}</span>
                      {c.business_name && (<span className="block text-xs text-muted-foreground">{c.business_name}</span>)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 border rounded-md bg-muted/30 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-muted-foreground">Cliente #{selectedClient.id}</span>
                <span className="block text-sm font-medium">{selectedClient.name}</span>
                {selectedClient.business_name && (<span className="block text-xs text-muted-foreground">{selectedClient.business_name}</span>)}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>Trocar</Button>
            </div>
          )}

          {selectedClient && (
            <>
              <div>
                <Label>Plano</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano..." /></SelectTrigger>
                  <SelectContent>
                    {activePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.max_devices} dispositivos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dispositivos Extras</Label>
                <Input type="number" min={0} value={extraDevices} onChange={(e) => setExtraDevices(Math.max(0, Number(e.target.value)))} />
              </div>
              {selectedPlan && (
                <div className="p-3 border rounded-md bg-muted/20 text-sm space-y-1">
                  <div className="flex justify-between"><span>Plano</span><span>R$ {Number(selectedPlan.monthly_price || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Minutos inclusos</span><span>{selectedPlan.included_minutes}</span></div>
                  <div className="flex justify-between"><span>Dispositivos máx.</span><span>{selectedPlan.max_devices + extraDevices}</span></div>
                  <div className="flex justify-between items-center">
                    <span>Provedor</span>
                    {selectedPlan.provider ? (
                      <Badge variant={selectedPlan.provider.type === 'wavoip_free' ? 'outline' : 'default'}>
                        {selectedPlan.provider.name} · {selectedPlan.provider.type === 'wavoip_free' ? 'Free' : 'Pago'}
                      </Badge>
                    ) : (<span className="text-destructive text-xs">sem provedor</span>)}
                  </div>
                </div>
              )}
              {selectedPlan && totalDeviceSlots > 0 && (
                <div className="space-y-2">
                  <Label>Nomes dos dispositivos ({totalDeviceSlots})</Label>
                  <p className="text-xs text-muted-foreground">
                    Será criado na Wavoip como <code>JU_{selectedClient?.id}_&lt;nome&gt;</code>.
                  </p>
                  {deviceNames.map((n, i) => (
                    <Input
                      key={i}
                      placeholder={`Dispositivo ${i + 1}`}
                      value={n}
                      onChange={(e) => setNameAt(i, e.target.value)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedClient || !selectedPlan || !selectedPlan?.provider_id || activate.isPending || !allNamesFilled}>
            {activate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}