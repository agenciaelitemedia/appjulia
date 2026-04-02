import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2, Star, Zap, Crown, Trash2, GripVertical } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  price_monthly: number;
  price_semiannual: number;
  price_annual: number;
  price_display: string;
  icon: string;
  color: string;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  position: number;
}

const emptyPlan: Omit<Plan, 'id'> = {
  name: '', price: 0, price_monthly: 0, price_semiannual: 0, price_annual: 0,
  price_display: '', icon: 'zap', color: 'from-blue-500 to-blue-600',
  features: [], is_popular: false, is_active: true, position: 0,
};

const iconOptions = [
  { value: 'zap', label: 'Zap ⚡' },
  { value: 'star', label: 'Star ⭐' },
  { value: 'crown', label: 'Crown 👑' },
];

const colorOptions = [
  { value: 'from-blue-500 to-blue-600', label: 'Azul' },
  { value: 'from-[#6C3AED] to-[#7C3AED]', label: 'Roxo' },
  { value: 'from-amber-500 to-amber-600', label: 'Dourado' },
  { value: 'from-green-500 to-green-600', label: 'Verde' },
  { value: 'from-red-500 to-red-600', label: 'Vermelho' },
];

const PlanosPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    const { data } = await supabase.from('julia_plans').select('*').order('position');
    if (data) setPlans(data.map(p => ({ ...p, features: (p.features as any) || [], price_monthly: (p as any).price_monthly ?? 0, price_semiannual: (p as any).price_semiannual ?? 0, price_annual: (p as any).price_annual ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyPlan, position: plans.length });
    setFeatureInput('');
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({ name: plan.name, price: plan.price, price_monthly: plan.price_monthly, price_semiannual: plan.price_semiannual, price_annual: plan.price_annual, price_display: plan.price_display, icon: plan.icon, color: plan.color, features: plan.features, is_popular: plan.is_popular, is_active: plan.is_active, position: plan.position });
    setFeatureInput('');
    setDialogOpen(true);
  };

  const addFeature = () => {
    if (!featureInput.trim()) return;
    setForm(f => ({ ...f, features: [...f.features, featureInput.trim()] }));
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        price: form.price,
        price_monthly: form.price_monthly,
        price_semiannual: form.price_semiannual,
        price_annual: form.price_annual,
        price_display: form.price_display || `R$ ${(form.price / 100).toFixed(0)}`,
        icon: form.icon,
        color: form.color,
        features: form.features as any,
        is_popular: form.is_popular,
        is_active: form.is_active,
        position: form.position,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        await supabase.from('julia_plans').update(payload).eq('id', editing.id);
        toast.success('Plano atualizado');
      } else {
        await supabase.from('julia_plans').insert(payload);
        toast.success('Plano criado');
      }
      setDialogOpen(false);
      fetchPlans();
    } catch {
      toast.error('Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: Plan) => {
    await supabase.from('julia_plans').update({ is_active: !plan.is_active, updated_at: new Date().toISOString() }).eq('id', plan.id);
    fetchPlans();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Plano</Button>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground">#</th>
                <th className="pb-3 font-medium text-muted-foreground">Nome</th>
                <th className="pb-3 font-medium text-muted-foreground">Preço</th>
                <th className="pb-3 font-medium text-muted-foreground">Features</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-3 text-muted-foreground">{plan.position + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.is_popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                    </div>
                  </td>
                  <td className="py-3 font-medium text-xs">
                    <div>M: R$ {(plan.price_monthly / 100).toFixed(0)}</div>
                    <div>S: R$ {(plan.price_semiannual / 100).toFixed(0)}</div>
                    <div>A: R$ {(plan.price_annual / 100).toFixed(0)}</div>
                  </td>
                  <td className="py-3 text-muted-foreground text-xs">{plan.features.length} items</td>
                  <td className="py-3">
                    <Badge variant={plan.is_active ? 'default' : 'outline'}>
                      {plan.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(plan)}>
                        <Switch checked={plan.is_active} className="pointer-events-none" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Plano Profissional" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço base (centavos)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Exibição do preço</Label>
                <Input value={form.price_display} onChange={e => setForm(f => ({ ...f, price_display: e.target.value }))} placeholder="R$ 497" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Mensal (¢)</Label>
                <Input type="number" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Semestral (¢)</Label>
                <Input type="number" value={form.price_semiannual} onChange={e => setForm(f => ({ ...f, price_semiannual: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Anual (¢)</Label>
                <Input type="number" value={form.price_annual} onChange={e => setForm(f => ({ ...f, price_annual: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Select value={form.color} onValueChange={v => setForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colorOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Posição</Label>
                <Input type="number" value={form.position} onChange={e => setForm(f => ({ ...f, position: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_popular} onCheckedChange={v => setForm(f => ({ ...f, is_popular: v }))} />
                  <Label>Popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Features</Label>
              <div className="flex gap-2 mt-1">
                <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)} placeholder="Ex: Até 2.000 leads/mês" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} />
                <Button type="button" variant="outline" onClick={addFeature}>+</Button>
              </div>
              <div className="mt-2 space-y-1">
                {form.features.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                    <span>{f}</span>
                    <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanosPage;
