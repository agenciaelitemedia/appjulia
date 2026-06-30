import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search } from 'lucide-react';
import { useClientSearch, type SearchedClient } from '@/pages/admin/telefonia/hooks/useClientSearch';
import { useActivateWavoipForUser, useFreeWavoipDevices, useWavoipPlans, type WavoipPlan } from '../hooks/useWavoipAdmin';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddWavoipDialog({ open, onOpenChange }: Props) {
  const { searchTerm, setSearchTerm, results, isLoading: searching } = useClientSearch();
  const { data: plans = [] } = useWavoipPlans();
  const { data: freeDevices = [] } = useFreeWavoipDevices();
  const activate = useActivateWavoipForUser();

  const [selectedClient, setSelectedClient] = useState<SearchedClient | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [extraDevices, setExtraDevices] = useState(0);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  const activePlans = plans.filter((p: WavoipPlan) => p.active);
  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId);
  const totalDeviceSlots = (selectedPlan?.max_devices ?? 0) + extraDevices;

  const reset = () => {
    setSelectedClient(null);
    setSelectedPlanId('');
    setExtraDevices(0);
    setSelectedDeviceIds([]);
    setSearchTerm('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const toggleDevice = (id: string) => {
    setSelectedDeviceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= totalDeviceSlots) return prev;
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (!selectedClient || !selectedPlan) return;
    activate.mutate({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      business_name: selectedClient.business_name,
      plan_id: selectedPlan.id,
      extra_devices: extraDevices,
      billing_period: 'monthly',
      device_ids: selectedDeviceIds,
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
                </div>
              )}
              {selectedPlan && (
                <div>
                  <Label>Dispositivos do pool ({selectedDeviceIds.length}/{totalDeviceSlots})</Label>
                  {freeDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 border rounded">Nenhum dispositivo livre no pool. Cadastre dispositivos em /admin/wavoip → Dispositivos.</p>
                  ) : (
                    <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                      {freeDevices.map((d) => {
                        const checked = selectedDeviceIds.includes(d.id);
                        const disabled = !checked && selectedDeviceIds.length >= totalDeviceSlots;
                        return (
                          <label key={d.id} className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/40 ${disabled ? 'opacity-50' : ''}`}>
                            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleDevice(d.id)} />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{d.device_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{d.device_token.slice(0, 8)}…{d.device_token.slice(-4)}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedClient || !selectedPlan || activate.isPending || (totalDeviceSlots > 0 && selectedDeviceIds.length === 0)}>
            {activate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}