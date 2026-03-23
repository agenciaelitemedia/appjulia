import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { AddTelefoniaDialog } from './AddTelefoniaDialog';
import { EditTelefoniaDialog } from './EditTelefoniaDialog';
import { BILLING_PERIOD_LABELS, type BillingPeriod, type PhoneUserPlan } from '../types';

function isExpired(up: PhoneUserPlan): boolean {
  if (!up.due_date) return false;
  return new Date(up.due_date) < new Date();
}

export function AgentsTelefoniaTab() {
  const { userPlans, userPlansLoading, plans, toggleUserPlanActive, deleteUserPlan } = useTelefoniaAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PhoneUserPlan | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<PhoneUserPlan | null>(null);

  const filtered = useMemo(() => {
    return userPlans.filter((up) => {
      if (statusFilter === 'active' && (!up.is_active || isExpired(up))) return false;
      if (statusFilter === 'expired' && !isExpired(up)) return false;
      if (statusFilter === 'inactive' && up.is_active) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchCod = up.cod_agent.toLowerCase().includes(q);
        const matchName = (up.client_name || '').toLowerCase().includes(q);
        const matchBiz = (up.business_name || '').toLowerCase().includes(q);
        if (!matchCod && !matchName && !matchBiz) return false;
      }
      return true;
    });
  }, [userPlans, search, statusFilter]);

  const calcTotal = (up: PhoneUserPlan) => {
    const period = up.billing_period as BillingPeriod;
    const map: Record<BillingPeriod, number> = {
      monthly: Number(up.price_monthly) || 0,
      quarterly: Number(up.price_quarterly) || 0,
      semiannual: Number(up.price_semiannual) || 0,
      annual: Number(up.price_annual) || 0,
    };
    const planPrice = map[period] || 0;
    const extrasPrice = (up.extra_extensions || 0) * (Number(up.extra_extension_price) || 0);
    return planPrice + extrasPrice;
  };

  const handleEdit = (up: PhoneUserPlan) => {
    setEditingPlan(up);
    setEditDialogOpen(true);
  };

  const handleToggleActive = (up: PhoneUserPlan) => {
    toggleUserPlanActive.mutate({ id: up.id, isActive: !up.is_active });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteUserPlan.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Agentes com Telefonia</CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Telefonia
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            placeholder="Buscar por código, nome ou escritório..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expired">Vencidos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {userPlansLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Cod Agent</TableHead>
                  <TableHead>Nome / Escritório</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Ramais</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Datas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((up) => {
                  const expired = isExpired(up);
                  const totalRamais = (up.max_extensions || 0) + (up.extra_extensions || 0);
                  const total = calcTotal(up);

                  const statusLabel = !up.is_active ? 'Inativo' : expired ? 'Vencido' : 'Ativo';
                  const statusVariant = !up.is_active ? 'secondary' : expired ? 'destructive' : 'default';

                  return (
                    <TableRow key={up.id} className={!up.is_active ? 'opacity-60' : ''}>
                      <TableCell>
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{up.cod_agent}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{up.client_name || '-'}</span>
                          {up.business_name && (
                            <span className="block text-xs text-muted-foreground">{up.business_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{up.plan_name || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {up.max_extensions || 0}
                        {up.extra_extensions > 0 && (
                          <span className="text-muted-foreground"> + {up.extra_extensions} extras</span>
                        )}
                        <span className="font-medium"> = {totalRamais}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {BILLING_PERIOD_LABELS[up.billing_period as BillingPeriod] || up.billing_period}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <span>{up.start_date ? new Date(up.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                          {up.due_date && (
                            <span className={`block ${expired ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              Venc: {new Date(up.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        R$ {total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(up)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(up)}>
                              <Power className="h-4 w-4 mr-2" /> {up.is_active ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(up)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhum agente encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AddTelefoniaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plans={plans.filter(p => p.is_active)}
      />

      <EditTelefoniaDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        plans={plans.filter(p => p.is_active)}
        userPlan={editingPlan}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover telefonia</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a telefonia do agente <strong>{deleteTarget?.cod_agent}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
