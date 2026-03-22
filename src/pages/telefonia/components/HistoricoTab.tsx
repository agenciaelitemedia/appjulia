import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneIncoming, PhoneOutgoing, Play, RefreshCw, LayoutDashboard, Phone, ExternalLink, Search, X } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { GravacaoPlayer } from './GravacaoPlayer';
import { useMemo, useState } from 'react';
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
  if (clean.startsWith('0') && (clean.length === 11 || clean.length === 12)) {
    clean = clean.slice(1);
  }
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

  // Filters
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [causeFilter, setCauseFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const extensionNameMap = new Map<string, string>();
  const extensionCodAgentMap = new Map<string, string>();
  for (const ext of extensions) {
    if (ext.extension_number) {
      const name = ext.api4com_first_name || ext.label || ext.extension_number;
      extensionNameMap.set(ext.extension_number, name);
      if (ext.api4com_last_name) extensionCodAgentMap.set(ext.extension_number, ext.api4com_last_name);
    }
  }

  const handleGoToCrm = (whatsappNumber: string) => {
    navigate(`/crm/leads?whatsapp=${encodeURIComponent(whatsappNumber)}`);
  };

  const hasActiveFilters = search || directionFilter !== 'all' || originFilter !== 'all' || causeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setDirectionFilter('all');
    setOriginFilter('all');
    setCauseFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const filteredHistory = useMemo(() => {
    return callHistory.filter((call) => {
      if (search) {
        const q = search.toLowerCase();
        const qDigits = search.replace(/\D/g, '');
        const calledClean = (call.called || '').replace(/\D/g, '');
        const callerClean = (call.caller || '').replace(/\D/g, '');
        const extKey = call.extension_number || call.caller || '';
        const attendant = (extensionNameMap.get(extKey) || '').toLowerCase();
        const extCodAgent = (extensionCodAgentMap.get(extKey) || codAgent || '').toLowerCase();
        const matchNumber = qDigits && (calledClean.includes(qDigits) || callerClean.includes(qDigits));
        const matchName = attendant.includes(q) || extCodAgent.includes(q);
        if (!matchNumber && !matchName) return false;
      }
      // Direction
      if (directionFilter !== 'all') {
        const isOutbound = call.direction === 'outbound' || call.direction === 'Sainte';
        if (directionFilter === 'outbound' && !isOutbound) return false;
        if (directionFilter === 'inbound' && isOutbound) return false;
      }
      // Origin
      if (originFilter !== 'all') {
        const meta = call.metadata || {};
        const origin = (meta as any)?.origin || 'MANUAL';
        if (originFilter !== origin) return false;
      }
      // Cause
      if (causeFilter !== 'all') {
        if ((call.hangup_cause || '') !== causeFilter) return false;
      }
      // Date range
      if (dateFrom && call.started_at) {
        if (new Date(call.started_at) < new Date(dateFrom)) return false;
      }
      if (dateTo && call.started_at) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(call.started_at) > end) return false;
      }
      return true;
    });
  }, [callHistory, search, directionFilter, originFilter, causeFilter, dateFrom, dateTo]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de Chamadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="outbound">Sainte</SelectItem>
              <SelectItem value="inbound">Entrante</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CRM">CRM</SelectItem>
              <SelectItem value="DISCADOR">Discador</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={causeFilter} onValueChange={setCauseFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="NORMAL_CLEARING">Atendida</SelectItem>
              <SelectItem value="ORIGINATOR_CANCEL">Cancelada</SelectItem>
              <SelectItem value="NO_ANSWER">Sem resposta</SelectItem>
              <SelectItem value="USER_BUSY">Ocupado</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] h-9" placeholder="De" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] h-9" placeholder="Até" />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filteredHistory.length} registro(s)</span>
        </div>

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
                  <TableHead>Causa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gravação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((call) => {
                  const meta = call.metadata || {};
                  const origin = (meta as any)?.origin as string | undefined;
                  const whatsappNumber = (meta as any)?.whatsapp_number as string | undefined;
                  const extName = extensionNameMap.get(call.extension_number || call.caller || '') || '';
                  const attendantName = extName ? `${extName} ${codAgent}` : codAgent;
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
                {filteredHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">Nenhuma chamada encontrada</TableCell>
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
