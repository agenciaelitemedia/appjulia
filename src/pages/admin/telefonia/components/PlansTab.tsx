import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { PlanDialog } from './PlanDialog';
import type { PhonePlan } from '../types';

export function PlansTab() {
  const { plans, plansLoading, createPlan, updatePlan, deletePlan } = useTelefoniaAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PhonePlan | null>(null);

  const handleSave = (plan: Partial<PhonePlan>) => {
    if (editingPlan) {
      updatePlan.mutate({ ...plan, id: editingPlan.id });
    } else {
      createPlan.mutate(plan);
    }
    setDialogOpen(false);
    setEditingPlan(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Planos de Ramais</CardTitle>
        <Button size="sm" onClick={() => { setEditingPlan(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Plano
        </Button>
      </CardHeader>
      <CardContent>
        {plansLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ramais</TableHead>
                  <TableHead>Mensal</TableHead>
                  <TableHead>Trimestral</TableHead>
                  <TableHead>Semestral</TableHead>
                  <TableHead>Anual</TableHead>
                  <TableHead>Extra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.max_extensions}</TableCell>
                    <TableCell className="text-xs">R$ {Number(plan.price_monthly).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">R$ {Number(plan.price_quarterly).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">R$ {Number(plan.price_semiannual).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">R$ {Number(plan.price_annual).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">R$ {Number(plan.extra_extension_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                        {plan.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPlan(plan); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePlan.mutate(plan.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum plano cadastrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editingPlan}
        onSave={handleSave}
      />
    </Card>
  );
}
