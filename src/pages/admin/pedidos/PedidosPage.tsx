import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders, type JuliaOrder } from './hooks/useOrders';
import { OrderDetailSheet } from './components/OrderDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { Search, DollarSign, Clock, CheckCircle, FileText, Loader2, Eye, Filter, X } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Pendente', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const PedidosPage = () => {
  const { orders, isLoading, stats } = useOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<JuliaOrder | null>(null);
  const [planNames, setPlanNames] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('julia_plans').select('name').eq('is_active', true).order('position').then(({ data }) => {
      if (data) setPlanNames(data.map(p => p.name));
    });
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (search) {
        const s = search.toLowerCase();
        const match = o.customer_name.toLowerCase().includes(s) ||
          o.customer_document.includes(search.replace(/\D/g, '')) ||
          o.order_nsu?.toLowerCase().includes(s) ||
          o.customer_email.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (planFilter !== 'all' && o.plan_name !== planFilter) return false;
      if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(o.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [orders, search, statusFilter, planFilter, dateFrom, dateTo]);

  const hasFilters = statusFilter !== 'all' || planFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter('all');
    setPlanFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: FileText, color: 'text-blue-500', label: 'Total', value: stats.total },
          { icon: CheckCircle, color: 'text-green-500', label: 'Pagos', value: stats.paid },
          { icon: Clock, color: 'text-yellow-500', label: 'Pendentes', value: stats.pending },
          { icon: FileText, color: 'text-gray-400', label: 'Rascunhos', value: stats.draft },
          { icon: DollarSign, color: 'text-[#6C3AED]', label: 'Receita', value: formatCurrency(stats.totalRevenue) },
        ].map(({ icon: Icon, color, label, value }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color}`} />
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar nome, CPF/CNPJ, NSU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusMap).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {planNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" placeholder="Data início" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" placeholder="Data fim" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="pb-3 font-medium text-muted-foreground">Documento</th>
                  <th className="pb-3 font-medium text-muted-foreground">Plano</th>
                  <th className="pb-3 font-medium text-muted-foreground">Valor</th>
                  <th className="pb-3 font-medium text-muted-foreground">Status</th>
                  <th className="pb-3 font-medium text-muted-foreground">Data</th>
                  <th className="pb-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const st = statusMap[order.status] || { label: order.status, variant: 'outline' as const };
                  return (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-xs">{order.customer_document}</td>
                      <td className="py-3">{order.plan_name || '-'}</td>
                      <td className="py-3 font-medium">{order.plan_price ? formatCurrency(order.plan_price) : '-'}</td>
                      <td className="py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="py-3 text-muted-foreground text-xs">{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <OrderDetailSheet order={selectedOrder} open={!!selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
};

export default PedidosPage;
