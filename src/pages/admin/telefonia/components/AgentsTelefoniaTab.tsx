import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { AddTelefoniaDialog } from './AddTelefoniaDialog';
import { BILLING_PERIOD_LABELS, getPlanPriceByPeriod, type BillingPeriod, type PhoneUserPlan } from '../types';

function isExpired(up: PhoneUserPlan): boolean {
  if (!up.due_date) return false;
  return new Date(up.due_date) < new Date();
}

export function AgentsTelefoniaTab() {
  const { userPlans, userPlansLoading, plans } = useTelefoniaAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return userPlans.filter((up) => {
      // Status filter
      if (statusFilter === 'active' && (!up.is_active || isExpired(up))) return false;
      if (statusFilter === 'expired' && !isExpired(up)) return false;

      // Search
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
    // Build a pseudo plan object for getPlanPriceByPeriod
    const planPrice = (() => {
      const map: Record<BillingPeriod, number> = {
        monthly: Number(up.price_monthly) || 0,
        quarterly: Number(up.price_quarterly) || 0,
        semiannual: Number(up.price_semiannual) || 0,
        annual: Number(up.price_annual) || 0,
      };
      return map[period] || 0;
    })();
    const extrasPrice = (up.extra_extensions || 0) * (Number(up.extra_extension_price) || 0);
    return planPrice + extrasPrice;
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
        {/* Filters */}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((up) => {
                  const expired = isExpired(up);
                  const totalRamais = (up.max_extensions || 0) + (up.extra_extensions || 0);
                  const total = calcTotal(up);

                  return (
                    <TableRow key={up.id}>
                      <TableCell>
                        <Badge variant={expired ? 'destructive' : up.is_active ? 'default' : 'secondary'}>
                          {expired ? 'Vencido' : up.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
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
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
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
    </Card>
  );
}
