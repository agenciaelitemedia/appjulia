import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  CircleSlash, Trash2, BadgeCheck,
} from 'lucide-react';
import {
  useVideoOrders, useConfirmVideoPayment, useRetryVideoProvision,
  useCancelVideoOrder, useDeleteVideoOrder, type VideoOrder,
} from '../hooks/useVideoOrders';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

export function VideoOrdersTab() {
  const { data: orders = [], isLoading } = useVideoOrders();
  const confirmPayment = useConfirmVideoPayment();
  const retry = useRetryVideoProvision();
  const cancelOrder = useCancelVideoOrder();
  const deleteOrder = useDeleteVideoOrder();

  const [confirmTarget, setConfirmTarget] = useState<VideoOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<VideoOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoOrder | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    paid: orders.filter((o) => o.status === 'paid').length,
    provisioned: orders.filter((o) => o.status === 'provisioned').length,
    revenue: orders.filter((o) => ['paid', 'provisioned'].includes(o.status))
      .reduce((a, b) => a + (b.total_amount ?? 0), 0),
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
        <CardHeader>
          <CardTitle>Pedidos de Videochamadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum pedido até o momento.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[160px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const s = STATUS_BADGE[o.status] ?? { label: o.status, variant: 'outline' as const };
                    const needsRetry = o.status === 'paid' && o.provisioning_error;
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{o.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{o.plan_name}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {o.recording_enabled && <Badge variant="secondary" className="text-[10px]">Gravação</Badge>}
                            {o.transcription_enabled && <Badge variant="secondary" className="text-[10px]">Transcrição</Badge>}
                            {o.extra_minute_packs > 0 && (
                              <Badge variant="secondary" className="text-[10px]">+{o.extra_minute_packs} pacotes</Badge>
                            )}
                          </div>
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
                          <div className="flex items-center gap-1 flex-wrap">
                            {needsRetry && (
                              <Button size="sm" variant="outline" className="rounded-full h-8"
                                onClick={() => retry.mutate(o.id)} disabled={retry.isPending}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Retentar
                              </Button>
                            )}
                            {(o.status === 'pending' || o.status === 'draft') && (
                              <Button size="sm" variant="outline"
                                className="rounded-full h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => setConfirmTarget(o)} title="Confirmar pagamento">
                                <BadgeCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {['pending', 'draft', 'paid', 'failed'].includes(o.status) && (
                              <Button size="sm" variant="outline"
                                className="rounded-full h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => setCancelTarget(o)} title="Cancelar pedido">
                                <CircleSlash className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline"
                              className="rounded-full h-8 text-rose-700 border-rose-300 hover:bg-rose-50"
                              onClick={() => { setDeleteConfirmed(false); setDeleteTarget(o); }} title="Excluir pedido">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento manualmente?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido de <strong>{confirmTarget?.customer_name}</strong> ({fmt(confirmTarget?.total_amount ?? 0)})
              será marcado como pago e o plano de videochamadas será provisionado imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) confirmPayment.mutate(confirmTarget.id);
                setConfirmTarget(null);
              }}
            >Sim, confirmar pagamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido ficará marcado como cancelado e não poderá mais ser pago. Esta ação não exclui o registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) cancelOrder.mutate(cancelTarget.id);
                setCancelTarget(null);
              }}
            >Sim, cancelar pedido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmed(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-700">Excluir pedido permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. O pedido de{' '}
              <strong>{deleteTarget?.customer_name}</strong> será removido do banco de dados.
              {deleteTarget?.status === 'provisioned' && (
                <span className="block mt-2 text-amber-700">
                  Atenção: este pedido já liberou o plano de videochamadas. A exclusão não cancela a assinatura ativa.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-3">
            <Switch id="confirm-delete-video-order" checked={deleteConfirmed} onCheckedChange={setDeleteConfirmed} />
            <Label htmlFor="confirm-delete-video-order" className="text-sm">
              Confirmo que quero excluir este pedido permanentemente
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteConfirmed}
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (deleteTarget && deleteConfirmed) deleteOrder.mutate(deleteTarget.id);
                setDeleteTarget(null);
                setDeleteConfirmed(false);
              }}
            >Excluir permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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