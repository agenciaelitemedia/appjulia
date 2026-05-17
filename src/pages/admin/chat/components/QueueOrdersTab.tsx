import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useQueueOrders, useRetryQueueProvisioning } from '../hooks/useQueueOrders';
import { PaymentSettingsDialog } from '@/pages/admin/pedidos/components/PaymentSettingsDialog';

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual',
};

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending: { label: 'Aguardando pagamento', variant: 'outline' },
  paid: { label: 'Pago — provisionando…', variant: 'outline' },
  provisioned: { label: 'Liberado', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'secondary' },
};

const fmt = (cents: number | null) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function QueueOrdersTab() {
  const { data: orders = [], isLoading } = useQueueOrders();
  const retry = useRetryQueueProvisioning();

  const stats = {
    total: orders.length,
    paid: orders.filter((o) => o.status === 'paid').length,
    provisioned: orders.filter((o) => o.status === 'provisioned').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    revenue: orders.filter((o) => ['paid', 'provisioned'].includes(o.status))
      .reduce((a, b) => a + (b.paid_amount ?? b.total_amount), 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Aguardando" value={stats.pending} />
        <StatCard label="Pagos pendentes" value={stats.paid} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
        <StatCard label="Liberados" value={stats.provisioned} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
        <StatCard label="Receita" value={fmt(stats.revenue)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos de Filas</CardTitle>
          <PaymentSettingsDialog />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum pedido até o momento.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NSU</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const s = STATUS_BADGE[o.status] ?? { label: o.status, variant: 'outline' as const };
                  const needsRetry = o.status === 'paid' && o.provisioning_error;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.order_nsu ?? '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{o.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{o.plan_name}</div>
                        {o.extra_queues > 0 && (
                          <Badge variant="secondary" className="text-[10px] mt-1">+{o.extra_queues} filas extras</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{PERIOD_LABELS[o.billing_period] ?? o.billing_period}</Badge>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{fmt(o.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {o.provisioning_error && (
                          <div className="text-xs text-rose-600 mt-1 truncate max-w-[200px]" title={o.provisioning_error}>
                            {o.provisioning_error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {needsRetry && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => retry.mutate(o.id)}
                            disabled={retry.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retentar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}