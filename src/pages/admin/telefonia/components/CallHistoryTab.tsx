import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function CallHistoryTab() {
  const { callHistory, callHistoryLoading } = useTelefoniaAdmin();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de Chamadas</CardTitle>
      </CardHeader>
      <CardContent>
        {callHistoryLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direção</TableHead>
                <TableHead>Ramal</TableHead>
                <TableHead>De → Para</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callHistory.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    {call.direction === 'outbound' ? (
                      <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                    ) : (
                      <PhoneIncoming className="h-4 w-4 text-green-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{call.extension_number || '-'}</TableCell>
                  <TableCell className="text-xs">
                    {call.caller || '-'} → {call.called || '-'}
                  </TableCell>
                  <TableCell className="text-xs">{formatDuration(call.duration_seconds)}</TableCell>
                  <TableCell className="text-xs">R$ {Number(call.cost).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={call.hangup_cause === 'NORMAL_CLEARING' ? 'default' : 'secondary'} className="text-[10px]">
                      {call.hangup_cause || 'em andamento'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {call.started_at ? new Date(call.started_at).toLocaleString('pt-BR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {callHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma chamada registrada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
