import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteWavoipPlan, useUpsertWavoipPlan, useWavoipPlans, type WavoipPlan } from '../hooks/useWavoipAdmin';
import { useWavoipProviders } from '../hooks/useWavoipProviders';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

const emptyPlan: Partial<WavoipPlan> = {
  name: '',
  description: '',
  monthly_price: 0,
  included_minutes: 0,
  max_devices: 1,
  device_model: 'free',
  provider_id: null,
  active: true,
  sort_order: 0,
};

export function WavoipPlansTab() {
  const { data: plans = [], isLoading } = useWavoipPlans();
  const { data: providers = [] } = useWavoipProviders();
  const upsert = useUpsertWavoipPlan();
  const del = useDeleteWavoipPlan();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<WavoipPlan>>(emptyPlan);
  const [deleteTarget, setDeleteTarget] = useState<WavoipPlan | null>(null);

  const startNew = () => { setEditing(emptyPlan); setOpen(true); };
  const startEdit = (p: WavoipPlan) => {
    const { provider: _p, ...rest } = p as any;
    setEditing(rest);
    setOpen(true);
  };

  const save = async () => {
    const provider = providers.find((p) => p.id === editing.provider_id);
    const derivedModel = provider?.type === 'wavoip_free' ? 'free' : 'paid';
    await upsert.mutateAsync({ ...editing, device_model: derivedModel });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Planos Wavoip</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo plano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Editar plano' : 'Novo plano'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Provedor Wavoip *</Label>
                <Select
                  value={editing.provider_id ?? ''}
                  onValueChange={(v) => setEditing({ ...editing, provider_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o provedor..." /></SelectTrigger>
                  <SelectContent>
                    {providers.filter((p) => p.is_active).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.type === 'wavoip_free' ? 'Free' : 'Pago'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço mensal (R$)</Label>
                  <Input type="number" step="0.01" value={editing.monthly_price ?? 0} onChange={(e) => setEditing({ ...editing, monthly_price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Minutos inclusos</Label>
                  <Input type="number" value={editing.included_minutes ?? 0} onChange={(e) => setEditing({ ...editing, included_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Máx. dispositivos</Label>
                  <Input type="number" value={editing.max_devices ?? 1} onChange={(e) => setEditing({ ...editing, max_devices: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={upsert.isPending || !editing.name || !editing.provider_id}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Minutos</TableHead>
              <TableHead>Dispositivos</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow>)}
            {!isLoading && plans.length === 0 && (<TableRow><TableCell colSpan={8} className="text-muted-foreground">Nenhum plano cadastrado.</TableCell></TableRow>)}
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm">{p.provider?.name ?? <span className="text-destructive text-xs">sem provedor</span>}</TableCell>
                <TableCell>R$ {Number(p.monthly_price).toFixed(2)}</TableCell>
                <TableCell>{p.included_minutes}</TableCell>
                <TableCell>{p.max_devices}</TableCell>
                <TableCell>{p.device_model}</TableCell>
                <TableCell>{p.active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Excluir plano permanentemente?"
        description={<>O plano <strong>{deleteTarget?.name}</strong> será removido. Esta ação <strong>não pode ser desfeita</strong>.</>}
        toggleLabel="Confirmo a exclusão definitiva deste plano"
        loading={del.isPending}
        onConfirm={() => {
          if (deleteTarget) del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </Card>
  );
}