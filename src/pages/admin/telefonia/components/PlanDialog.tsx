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
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setMaxExtensions(plan.max_extensions);
      setPrice(Number(plan.price));
      setDescription(plan.description || '');
      setIsActive(plan.is_active);
    } else {
      setName('');
      setMaxExtensions(5);
      setPrice(0);
      setDescription('');
      setIsActive(true);
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
              <Label>Preço (R$)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} step={0.01} />
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
          <Button onClick={() => onSave({ name, max_extensions: maxExtensions, price, description: description || null, is_active: isActive })} disabled={!name}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
