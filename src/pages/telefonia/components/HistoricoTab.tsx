import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PhoneIncoming, PhoneOutgoing, Play, RefreshCw } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { GravacaoPlayer } from './GravacaoPlayer';
import { useState } from 'react';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface Props {
  codAgent: string;
}

export function HistoricoTab({ codAgent }: Props) {
  const { callHistory, callHistoryLoading, syncCallHistory } = useTelefoniaData(codAgent);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Minhas Chamadas</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncCallHistory.mutate()}
          disabled={syncCallHistory.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${syncCallHistory.isPending ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {playingUrl && (
          <GravacaoPlayer url={playingUrl} onClose={() => setPlayingUrl(null)} />
        )}

        {callHistoryLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direção</TableHead>
                <TableHead>De → Para</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Gravação</TableHead>
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
                  <TableCell className="text-xs">
                    {call.caller || '-'} → {call.called || '-'}
                  </TableCell>
                  <TableCell className="text-xs">{formatDuration(call.duration_seconds)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {call.started_at ? new Date(call.started_at).toLocaleString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    {call.record_url ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlayingUrl(call.record_url)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {callHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma chamada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
