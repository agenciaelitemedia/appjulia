import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeactivateWavoipUserPlan, useToggleWavoipUserPlanActive, useUpdateWavoipUserPlan, useWavoipPlans, useWavoipUserPlans, type WavoipUserPlan } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';
import { AddWavoipDialog } from './AddWavoipDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function WavoipClientsTab() {
  const { data: userPlans = [], isLoading } = useWavoipUserPlans();
  const { data: plans = [] } = useWavoipPlans();
  const toggleActive = useToggleWavoipUserPlanActive();
  const deactivate = useDeactivateWavoipUserPlan();
  const update = useUpdateWavoipUserPlan();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WavoipUserPlan | null>(null);
  const [editTarget, setEditTarget] = useState<WavoipUserPlan | null>(null);
  const [editPlanId, setEditPlanId] = useState('');
  const [editExtras, setEditExtras] = useState(0);
  const [editBilling, setEditBilling] = useState('monthly');

  const startEdit = (up: WavoipUserPlan) => {
    setEditTarget(up);
    setEditPlanId(up.plan_id);
    setEditExtras(up.extra_devices ?? 0);
    setEditBilling(up.billing_period ?? 'monthly');
  };

  const saveEdit = () => {
    if (!editTarget) return;
    update.mutate(
      { id: editTarget.id, plan_id: editPlanId, extra_devices: editExtras, billing_period: editBilling },
      { onSuccess: () => setEditTarget(null) }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Clientes com Wavoip</CardTitle>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Adicionar Wavoip
        </Button>
        <AddWavoipDialog open={open} onOpenChange={setOpen} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ativado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>)}
            {!isLoading && userPlans.length === 0 && (<TableRow><TableCell colSpan={6} className="text-muted-foreground">Nenhum cliente ativado.</TableCell></TableRow>)}
            {userPlans.map((up) => (
              <TableRow key={up.id}>
                <TableCell>
                  <div className="font-medium text-sm">{up.client_name ?? `Cliente #${up.client_id ?? '-'}`}</div>
                  {up.business_name && <div className="text-xs text-muted-foreground">{up.business_name}</div>}
                  {up.client_id != null && <div className="font-mono text-[10px] text-muted-foreground">#{up.client_id}</div>}
                </TableCell>
                <TableCell>{up.plan?.name ?? '-'}</TableCell>
                <TableCell>{up.extra_devices ?? 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!up.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: up.id, is_active: v })}
                    />
                    {up.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                  </div>
                </TableCell>
                <TableCell>{up.activated_at ? format(new Date(up.activated_at), 'dd/MM/yyyy') : '-'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(up)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(up)} title="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ativação Wavoip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <div className="text-sm">{editTarget?.client_name ?? `Cliente #${editTarget?.client_id ?? '-'}`}</div>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={editPlanId} onValueChange={setEditPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dispositivos extras</Label>
                <Input type="number" min={0} value={editExtras} onChange={(e) => setEditExtras(Number(e.target.value))} />
              </div>
              <div>
                <Label>Periodicidade</Label>
                <Select value={editBilling} onValueChange={setEditBilling}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={update.isPending || !editPlanId}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remover ativação Wavoip do cliente?"
        description={
          <>
            A ativação de <strong>{deleteTarget?.client_name ?? `Cliente #${deleteTarget?.client_id ?? '-'}`}</strong> será cancelada e os dispositivos vinculados serão liberados de volta ao pool.
          </>
        }
        confirmLabel="Remover ativação"
        toggleLabel="Confirmo o cancelamento desta ativação"
        loading={deactivate.isPending}
        onConfirm={() => {
          if (deleteTarget) deactivate.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </Card>
  );
}