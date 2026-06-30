import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWavoipCallLogs } from '../hooks/useWavoipAdmin';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export function WavoipHistoryTab() {
  const { data: logs = [], isLoading } = useWavoipCallLogs();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const webhookUrl = projectId ? `https://${projectId}.functions.supabase.co/wavoip-call-webhook` : '';
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Webhook de eventos</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{webhookUrl || 'indisponível'}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada'); }} disabled={!webhookUrl}>
            <Copy className="h-4 w-4 mr-1" /> Copiar
          </Button>
        </CardContent>
      </Card>
    <Card>
      <CardHeader><CardTitle className="text-lg">Histórico de chamadas</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Direção</TableHead>
              <TableHead>De</TableHead>
              <TableHead>Para</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>)}
            {!isLoading && logs.length === 0 && (<TableRow><TableCell colSpan={6} className="text-muted-foreground">Sem chamadas registradas.</TableCell></TableRow>)}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{format(new Date(l.created_at), 'dd/MM HH:mm')}</TableCell>
                <TableCell><Badge variant="outline">{l.direction}</Badge></TableCell>
                <TableCell>{l.from_number ?? '-'}</TableCell>
                <TableCell>{l.to_number ?? '-'}</TableCell>
                <TableCell>{fmtDuration(l.duration_seconds || 0)}</TableCell>
                <TableCell><Badge variant={l.status === 'answered' ? 'default' : 'outline'}>{l.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}