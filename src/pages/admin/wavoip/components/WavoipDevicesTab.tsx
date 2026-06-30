import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWavoipDevices } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';

export function WavoipDevicesTab() {
  const { data: devices = [], isLoading } = useWavoipDevices();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Dispositivos Wavoip</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>)}
            {!isLoading && devices.length === 0 && (<TableRow><TableCell colSpan={7} className="text-muted-foreground">Nenhum dispositivo provisionado.</TableCell></TableRow>)}
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.user_id}</TableCell>
                <TableCell>{d.device_name ?? '-'}</TableCell>
                <TableCell>{d.whatsapp_number ?? '-'}</TableCell>
                <TableCell className="font-mono text-xs">{d.device_token.slice(0, 12)}…</TableCell>
                <TableCell>{d.device_model}</TableCell>
                <TableCell><Badge variant={d.status === 'active' ? 'default' : 'outline'}>{d.status}</Badge></TableCell>
                <TableCell>{d.last_seen_at ? format(new Date(d.last_seen_at), 'dd/MM HH:mm') : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}