import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneIncoming, PhoneOutgoing, Play, LayoutDashboard, Phone, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { useCallHistoryQuery } from '../hooks/useCallHistoryQuery';
import { GravacaoPlayer } from './GravacaoPlayer';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState, CustomSelectConfig } from '@/components/filters/types';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';

const PAGE_SIZE = 50;

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
  const { extensions } = useTelefoniaData(codAgent);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  // Telephony-specific filters (managed locally)
  const [directionFilter, setDirectionFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [causeFilter, setCauseFilter] = useState('all');

  // Build agent list from extensions' last_name (cod_agent) + first_name
  const agentsList = useMemo(() => {
    const agentMap = new Map<string, { cod_agent: string; owner_name: string }>();
    for (const ext of extensions) {
      const agentCode = ext.api4com_last_name || codAgent;
      if (agentCode && !agentMap.has(agentCode)) {
        agentMap.set(agentCode, {
          cod_agent: agentCode,
          owner_name: ext.api4com_first_name || ext.label || agentCode,
        });
      }
    }
    if (!agentMap.has(codAgent)) {
      agentMap.set(codAgent, { cod_agent: codAgent, owner_name: codAgent });
    }
    return Array.from(agentMap.values());
  }, [extensions, codAgent]);

  // UnifiedFilters state (period + search + agents)
  const today = getTodayInSaoPaulo();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
  });

  // Initialize/update agentCodes when agent list changes
  useEffect(() => {
    if (agentsList.length > 0) {
      setFilters(prev => ({ ...prev, agentCodes: agentsList.map(a => a.cod_agent) }));
    }
  }, [agentsList]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filters.dateFrom, filters.dateTo, directionFilter, causeFilter, originFilter, filters.search, filters.agentCodes]);

  // Server-side query with date, direction, cause filters + pagination
  const { data: historyResult, isLoading: callHistoryLoading } = useCallHistoryQuery(codAgent, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    direction: directionFilter,
    cause: causeFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const serverData = historyResult?.data || [];
  const totalCount = historyResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Extension maps for display
  const extensionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ext of extensions) {
      if (ext.extension_number) {
        map.set(ext.extension_number, ext.api4com_first_name || ext.label || ext.extension_number);
      }
    }
    return map;
  }, [extensions]);

  const extensionCodAgentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ext of extensions) {
      if (ext.extension_number) {
        map.set(ext.extension_number, ext.api4com_last_name || codAgent);
      }
    }
    return map;
  }, [extensions, codAgent]);

  // Client-side filters for origin, search, agent (can't filter these in DB easily)
  const filteredHistory = useMemo(() => {
    return serverData.filter((call) => {
      // Agent filter
      if (filters.agentCodes.length > 0 && filters.agentCodes.length < agentsList.length) {
        const extKey = call.extension_number || call.caller || '';
        const callAgent = extensionCodAgentMap.get(extKey) || codAgent;
        if (!filters.agentCodes.includes(callAgent)) return false;
      }
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const qDigits = filters.search.replace(/\D/g, '');
        const calledClean = (call.called || '').replace(/\D/g, '');
        const callerClean = (call.caller || '').replace(/\D/g, '');
        const extKey = call.extension_number || call.caller || '';
        const attendant = (extensionNameMap.get(extKey) || '').toLowerCase();
        const extCodAgent = (extensionCodAgentMap.get(extKey) || codAgent || '').toLowerCase();
        const matchNumber = qDigits && (calledClean.includes(qDigits) || callerClean.includes(qDigits));
        const matchName = attendant.includes(q) || extCodAgent.includes(q);
        if (!matchNumber && !matchName) return false;
      }
      // Origin (client-side, stored in metadata)
      if (originFilter !== 'all') {
        const meta = call.metadata || {};
        const origin = (meta as any)?.origin || 'MANUAL';
        if (originFilter !== origin) return false;
      }
      return true;
    });
  }, [serverData, filters.search, filters.agentCodes, originFilter, agentsList.length, extensionNameMap, extensionCodAgentMap, codAgent]);

  const handleGoToCrm = (whatsappNumber: string) => {
    navigate(`/crm/leads?whatsapp=${encodeURIComponent(whatsappNumber)}`);
  };

  const customSelects: CustomSelectConfig[] = [
    {
      key: 'direction',
      placeholder: 'Sentido',
      value: directionFilter,
      onChange: setDirectionFilter,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'outbound', label: 'Saída' },
        { value: 'inbound', label: 'Recebidas' },
      ],
      width: 'w-[130px]',
    },
    {
      key: 'origin',
      placeholder: 'Origem',
      value: originFilter,
      onChange: setOriginFilter,
      options: [
        { value: 'all', label: 'Todas' },
        { value: 'CRM', label: 'CRM' },
        { value: 'DISCADOR', label: 'Discador' },
        { value: 'MANUAL', label: 'Manual' },
      ],
      width: 'w-[130px]',
    },
    {
      key: 'cause',
      placeholder: 'Status',
      value: causeFilter,
      onChange: setCauseFilter,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'NORMAL_CLEARING', label: 'Atendida' },
        { value: 'ORIGINATOR_CANCEL', label: 'Cancelada' },
        { value: 'NO_ANSWER', label: 'Sem resposta' },
        { value: 'USER_BUSY', label: 'Ocupado' },
      ],
      width: 'w-[140px]',
    },
  ];

  return (
    <div className="space-y-4">
      <UnifiedFilters
        agents={agentsList}
        filters={filters}
        onFiltersChange={setFilters}
        showAgentSelector={true}
        showSearch={true}
        showQuickPeriods={true}
        searchPlaceholder="Buscar por número ou atendente..."
        customSelects={customSelects}
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Histórico de Chamadas</CardTitle>
            <span className="text-xs text-muted-foreground">
              {filteredHistory.length} de {totalCount} registro(s)
              {totalPages > 1 && ` · Página ${page + 1} de ${totalPages}`}
            </span>
          </div>
        </CardHeader>
        <CardContent>
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
                          {call.direction === 'outbound' ? (
                            <span className="flex items-center gap-1">
                              <PhoneOutgoing className="h-3.5 w-3.5 text-primary" />
                              Saída
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                              Recebida
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <span className="text-xs text-muted-foreground">
                {totalCount} registro(s) no total
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
