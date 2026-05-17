import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { QueuePlan } from '../hooks/useQueuePlansAdmin';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: QueuePlan | null;
  onSave: (plan: Partial<QueuePlan>) => void;
}

export function QueuePlanDialog({ open, onOpenChange, plan, onSave }: Props) {
  const [name, setName] = useState('');
  const [maxQueues, setMaxQueues] = useState(1);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceQuarterly, setPriceQuarterly] = useState(0);
  const [priceSemiannual, setPriceSemiannual] = useState(0);
  const [priceAnnual, setPriceAnnual] = useState(0);
  const [extraQueuePrice, setExtraQueuePrice] = useState(0);
  const [setupMonthly, setSetupMonthly] = useState<string>('');
  const [setupQuarterly, setSetupQuarterly] = useState<string>('');
  const [setupSemiannual, setSetupSemiannual] = useState<string>('');
  const [setupAnnual, setSetupAnnual] = useState<string>('');

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setMaxQueues(plan.max_queues);
      setDescription(plan.description || '');
      setIsActive(plan.is_active);
      setPriceMonthly(Number(plan.price_monthly) || 0);
      setPriceQuarterly(Number(plan.price_quarterly) || 0);
      setPriceSemiannual(Number(plan.price_semiannual) || 0);
      setPriceAnnual(Number(plan.price_annual) || 0);
      setExtraQueuePrice(Number(plan.extra_queue_price) || 0);
      const toStr = (v: number | null | undefined) =>
        v === null || v === undefined ? '' : String(v);
      setSetupMonthly(toStr(plan.setup_fee_monthly));
      setSetupQuarterly(toStr(plan.setup_fee_quarterly));
      setSetupSemiannual(toStr(plan.setup_fee_semiannual));
      setSetupAnnual(toStr(plan.setup_fee_annual));
    } else {
      setName(''); setMaxQueues(1); setDescription(''); setIsActive(true);
      setPriceMonthly(0); setPriceQuarterly(0); setPriceSemiannual(0); setPriceAnnual(0);
      setExtraQueuePrice(0);
      setSetupMonthly(''); setSetupQuarterly(''); setSetupSemiannual(''); setSetupAnnual('');
    }
  }, [plan, open]);

  const parseSetup = (v: string): number | null => {
    const s = v.trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano de Filas' : 'Novo Plano de Filas'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Básico" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Máx. Filas</Label>
              <Input type="number" value={maxQueues} onChange={(e) => setMaxQueues(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>Preço Fila Extra (R$)</Label>
              <Input type="number" value={extraQueuePrice} onChange={(e) => setExtraQueuePrice(Number(e.target.value))} min={0} step={0.01} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mensal (R$)</Label>
              <Input type="number" value={priceMonthly} onChange={(e) => setPriceMonthly(Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div>
              <Label>Trimestral (R$)</Label>
              <Input type="number" value={priceQuarterly} onChange={(e) => setPriceQuarterly(Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div>
              <Label>Semestral (R$)</Label>
              <Input type="number" value={priceSemiannual} onChange={(e) => setPriceSemiannual(Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div>
              <Label>Anual (R$)</Label>
              <Input type="number" value={priceAnnual} onChange={(e) => setPriceAnnual(Number(e.target.value))} min={0} step={0.01} />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div>
              <Label className="text-base">Taxa de Setup por periodicidade</Label>
              <p className="text-xs text-muted-foreground">
                Vazio = sem taxa de setup · <span className="font-medium">0</span> = grátis (destaque) · valor &gt; 0 = cobrar
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Setup Mensal (R$)</Label>
                <Input type="number" value={setupMonthly} onChange={(e) => setSetupMonthly(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" />
              </div>
              <div>
                <Label>Setup Trimestral (R$)</Label>
                <Input type="number" value={setupQuarterly} onChange={(e) => setSetupQuarterly(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" />
              </div>
              <div>
                <Label>Setup Semestral (R$)</Label>
                <Input type="number" value={setupSemiannual} onChange={(e) => setSetupSemiannual(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" />
              </div>
              <div>
                <Label>Setup Anual (R$)</Label>
                <Input type="number" value={setupAnnual} onChange={(e) => setSetupAnnual(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" />
              </div>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do plano..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              name,
              max_queues: maxQueues,
              price_monthly: priceMonthly,
              price_quarterly: priceQuarterly,
              price_semiannual: priceSemiannual,
              price_annual: priceAnnual,
              extra_queue_price: extraQueuePrice,
              setup_fee_monthly: parseSetup(setupMonthly),
              setup_fee_quarterly: parseSetup(setupQuarterly),
              setup_fee_semiannual: parseSetup(setupSemiannual),
              setup_fee_annual: parseSetup(setupAnnual),
              description: description || null,
              is_active: isActive,
            })}
            disabled={!name}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}