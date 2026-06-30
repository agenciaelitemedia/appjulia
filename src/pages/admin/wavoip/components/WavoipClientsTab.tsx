import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Power, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useActivateWavoipForUser, useDeactivateWavoipUserPlan, useWavoipPlans, useWavoipUserPlans } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';

export function WavoipClientsTab() {
  const { data: userPlans = [], isLoading } = useWavoipUserPlans();
  const { data: plans = [] } = useWavoipPlans();
  const activate = useActivateWavoipForUser();
  const deactivate = useDeactivateWavoipUserPlan();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [planId, setPlanId] = useState('');

  const submit = async () => {
    if (!userId || !planId) return;
    await activate.mutateAsync({ user_id: userId, plan_id: planId });
    setOpen(false);
    setUserId(''); setPlanId('');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Clientes com Wavoip</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Ativar para cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ativar Wavoip</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>User ID (uuid auth)</Label>
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-..." />
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.active).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={!userId || !planId || activate.isPending}>Ativar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ativado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>)}
            {!isLoading && userPlans.length === 0 && (<TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhum cliente ativado.</TableCell></TableRow>)}
            {userPlans.map((up) => (
              <TableRow key={up.id}>
                <TableCell className="font-mono text-xs">{up.user_id}</TableCell>
                <TableCell>{up.plan?.name ?? '-'}</TableCell>
                <TableCell>{up.status === 'active' ? <Badge>Ativo</Badge> : <Badge variant="outline">{up.status}</Badge>}</TableCell>
                <TableCell>{up.activated_at ? format(new Date(up.activated_at), 'dd/MM/yyyy') : '-'}</TableCell>
                <TableCell className="text-right">
                  {up.status === 'active' && (
                    <Button size="icon" variant="ghost" onClick={() => deactivate.mutate(up.id)} title="Desativar">
                      <Power className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}