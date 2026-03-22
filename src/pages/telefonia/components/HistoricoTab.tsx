import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneIncoming, PhoneOutgoing, Play, RefreshCw, LayoutDashboard, Phone, ExternalLink } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { GravacaoPlayer } from './GravacaoPlayer';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '-';
  let clean = phone.replace(/\D/g, '');
  // Api4Com sends 0DDNNNNNNNNN — remove leading 0
  if (clean.startsWith('0') && (clean.length === 11 || clean.length === 12)) {
    clean = clean.slice(1);
  }
  // Remove country code 55
  if (clean.startsWith('55') && clean.length >= 12) {
    clean = clean.slice(2);
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatHangupCause(cause: string | null): string {
  if (!cause) return '-';
  const map: Record<string, string> = {
    'NORMAL_CLEARING': 'Atendida',
    'ORIGINATOR_CANCEL': 'Cancelada',
    'NUMBER_CHANGED': 'Caixa postal',
    'NO_ANSWER': 'Sem resposta',
    'USER_BUSY': 'Ocupado',
    'CALL_REJECTED': 'Rejeitada',
    'UNALLOCATED_NUMBER': 'Inexistente',
    'normal_clearing': 'Atendida',
  };
  return map[cause] || cause;
}

function getHangupBadgeVariant(cause: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!cause) return 'outline';
  if (cause === 'NORMAL_CLEARING' || cause === 'normal_clearing') return 'default';
  if (cause === 'ORIGINATOR_CANCEL') return 'secondary';
  return 'outline';
}

interface Props {
  codAgent: string;
}

export function HistoricoTab({ codAgent }: Props) {
  const { callHistory, callHistoryLoading, syncCallHistory, extensions } = useTelefoniaData(codAgent);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  // Build a map of extension_number -> first name
  const extensionNameMap = new Map<string, string>();
  for (const ext of extensions) {
    if (ext.extension_number) {
      const name = ext.api4com_first_name || ext.label || ext.extension_number;
      extensionNameMap.set(ext.extension_number, name);
    }
  }

  const handleGoToCrm = (whatsappNumber: string) => {
    navigate(`/crm?whatsapp=${encodeURIComponent(whatsappNumber)}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Histórico de Chamadas</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncCallHistory.mutate({})}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Ramal</TableHead>
                  <TableHead>Número discado</TableHead>
                  <TableHead>Iniciou às</TableHead>
                  <TableHead>Finalizou às</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gravação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callHistory.map((call) => {
                  const meta = call.metadata || {};
                  const origin = (meta as any)?.origin as string | undefined;
                  const whatsappNumber = (meta as any)?.whatsapp_number as string | undefined;
                  const extName = extensionNameMap.get(call.extension_number || call.caller || '') || '';
                  const attendantName = extName ? `${extName} ${codAgent}` : codAgent;
                  const minutePrice = (meta as any)?.minute_price;
                  const hasDuration = call.duration_seconds != null && call.duration_seconds > 0;
                  
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {origin === 'CRM' ? (
                          <div className="flex items-center gap-1">
                            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                            <span>CRM</span>
                            {whatsappNumber && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleGoToCrm(whatsappNumber)}
                                title="Ver no CRM"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : origin === 'DISCADOR' ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Discador</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Manual</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {attendantName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {call.extension_number || call.caller || '-'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatPhone(call.called)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {call.started_at ? new Date(call.started_at).toLocaleString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {call.ended_at ? new Date(call.ended_at).toLocaleString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatDuration(call.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {minutePrice != null ? `R$ ${Number(minutePrice).toFixed(2)}` : ''}
                      </TableCell>
                      <TableCell className="text-xs">
                        {call.cost > 0 ? `R$ ${Number(call.cost).toFixed(2)}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getHangupBadgeVariant(call.hangup_cause)} className="text-[10px] whitespace-nowrap">
                          {formatHangupCause(call.hangup_cause)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {call.direction === 'outbound' || call.direction === 'Sainte' ? (
                          <span className="flex items-center gap-1">
                            <PhoneOutgoing className="h-3.5 w-3.5 text-primary" />
                            Sainte
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                            Entrante
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.record_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPlayingUrl(call.record_url)}
                            disabled={!hasDuration}
                            title={!hasDuration ? 'Sem gravação disponível' : 'Reproduzir gravação'}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {callHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">Nenhuma chamada registrada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
