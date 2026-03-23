import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PhonePlan } from '../types';

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PhonePlan | null;
  onSave: (plan: Partial<PhonePlan>) => void;
}

export function PlanDialog({ open, onOpenChange, plan, onSave }: PlanDialogProps) {
  const [name, setName] = useState('');
  const [maxExtensions, setMaxExtensions] = useState(5);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceQuarterly, setPriceQuarterly] = useState(0);
  const [priceSemiannual, setPriceSemiannual] = useState(0);
  const [priceAnnual, setPriceAnnual] = useState(0);
  const [extraExtensionPrice, setExtraExtensionPrice] = useState(0);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setMaxExtensions(plan.max_extensions);
      setDescription(plan.description || '');
      setIsActive(plan.is_active);
      setPriceMonthly(Number(plan.price_monthly) || 0);
      setPriceQuarterly(Number(plan.price_quarterly) || 0);
      setPriceSemiannual(Number(plan.price_semiannual) || 0);
      setPriceAnnual(Number(plan.price_annual) || 0);
      setExtraExtensionPrice(Number(plan.extra_extension_price) || 0);
    } else {
      setName('');
      setMaxExtensions(5);
      setDescription('');
      setIsActive(true);
      setPriceMonthly(0);
      setPriceQuarterly(0);
      setPriceSemiannual(0);
      setPriceAnnual(0);
      setExtraExtensionPrice(0);
    }
  }, [plan, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Básico" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Máx. Ramais</Label>
              <Input type="number" value={maxExtensions} onChange={(e) => setMaxExtensions(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>Preço Ramal Extra (R$)</Label>
              <Input type="number" value={extraExtensionPrice} onChange={(e) => setExtraExtensionPrice(Number(e.target.value))} min={0} step={0.01} />
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
              max_extensions: maxExtensions,
              price_monthly: priceMonthly,
              price_quarterly: priceQuarterly,
              price_semiannual: priceSemiannual,
              price_annual: priceAnnual,
              extra_extension_price: extraExtensionPrice,
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
