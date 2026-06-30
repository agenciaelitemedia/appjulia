import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWavoipOrders } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';

export function WavoipOrdersTab() {
  const { data: orders = [], isLoading } = useWavoipOrders();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Pedidos</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>)}
            {!isLoading && orders.length === 0 && (<TableRow><TableCell colSpan={6} className="text-muted-foreground">Nenhum pedido.</TableCell></TableRow>)}
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.user_id}</TableCell>
                <TableCell>R$ {Number(o.amount).toFixed(2)}</TableCell>
                <TableCell><Badge variant={o.status === 'paid' ? 'default' : 'outline'}>{o.status}</Badge></TableCell>
                <TableCell>{o.payment_provider ?? '-'}</TableCell>
                <TableCell>{o.paid_at ? format(new Date(o.paid_at), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                <TableCell>{format(new Date(o.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}