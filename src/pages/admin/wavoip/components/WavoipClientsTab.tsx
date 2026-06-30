import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { useDeactivateWavoipUserPlan, useToggleWavoipUserPlanActive, useWavoipUserPlans } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';
import { AddWavoipDialog } from './AddWavoipDialog';

export function WavoipClientsTab() {
  const { data: userPlans = [], isLoading } = useWavoipUserPlans();
  const toggleActive = useToggleWavoipUserPlanActive();
  const deactivate = useDeactivateWavoipUserPlan();
  const [open, setOpen] = useState(false);

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
                  <Button size="icon" variant="ghost" onClick={() => deactivate.mutate(up.id)} title="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}