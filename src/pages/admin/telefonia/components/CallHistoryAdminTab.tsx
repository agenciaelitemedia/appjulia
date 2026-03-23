import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneIncoming, PhoneOutgoing, Play, LayoutDashboard, Phone, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallHistoryQuery } from '@/pages/telefonia/hooks/useCallHistoryQuery';
import { GravacaoPlayer } from '@/pages/telefonia/components/GravacaoPlayer';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState, CustomSelectConfig } from '@/components/filters/types';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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

export function CallHistoryAdminTab() {
  const { userPlans } = useTelefoniaAdmin();
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const [directionFilter, setDirectionFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [causeFilter, setCauseFilter] = useState('all');

  // All agent codes from user plans
  const allAgentCodes = useMemo(() => {
    return [...new Set(userPlans.filter(up => up.is_active).map(up => up.cod_agent))];
  }, [userPlans]);

  // Load extensions for all agents
  const extensionsQuery = useQuery({
    queryKey: ['admin-all-extensions', allAgentCodes],
    queryFn: async () => {
      if (allAgentCodes.length === 0) return [];
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .in('cod_agent', allAgentCodes);
      if (error) throw error;
      return data || [];
    },
    enabled: allAgentCodes.length > 0,
  });
  const extensions = extensionsQuery.data || [];

  // Build agent list for selector
  const agentsList = useMemo(() => {
    return allAgentCodes.map(code => {
      const up = userPlans.find(u => u.cod_agent === code && u.is_active);
      return {
        cod_agent: code,
        owner_name: up?.client_name || code,
      };
    });
  }, [allAgentCodes, userPlans]);

  const today = getTodayInSaoPaulo();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
  });

  useEffect(() => {
    if (allAgentCodes.length > 0 && filters.agentCodes.length === 0) {
      setFilters(prev => ({ ...prev, agentCodes: allAgentCodes }));
    }
  }, [allAgentCodes]);

  useEffect(() => {
    setPage(0);
  }, [filters.dateFrom, filters.dateTo, directionFilter, causeFilter, originFilter, filters.search, filters.agentCodes]);

  // Use first selected agent for query (or first available)
  const queryCodAgent = filters.agentCodes.length > 0 ? filters.agentCodes[0] : allAgentCodes[0];

  // For admin, we query without cod_agent filter — use a custom query
  const queryResult = useQuery({
    queryKey: ['admin-call-history', filters.agentCodes, filters.dateFrom, filters.dateTo, directionFilter, causeFilter, page],
    queryFn: async () => {
      const fromISO = `${filters.dateFrom}T00:00:00-03:00`;
      const toISO = `${filters.dateTo}T23:59:59.999-03:00`;

      let query = supabase
        .from('phone_call_logs')
        .select('*', { count: 'exact' })
        .gte('started_at', fromISO)
        .lte('started_at', toISO);

      // Filter by selected agents
      if (filters.agentCodes.length > 0 && filters.agentCodes.length < allAgentCodes.length) {
        query = query.in('cod_agent', filters.agentCodes);
      } else if (allAgentCodes.length > 0) {
        query = query.in('cod_agent', allAgentCodes);
      }

      if (directionFilter && directionFilter !== 'all') {
        query = query.eq('direction', directionFilter);
      }
      if (causeFilter && causeFilter !== 'all') {
        query = query.eq('hangup_cause', causeFilter);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      query = query.order('started_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], totalCount: count ?? 0 };
    },
    enabled: allAgentCodes.length > 0 && !!filters.dateFrom && !!filters.dateTo,
    placeholderData: (prev) => prev,
  });

  const serverData = queryResult.data?.data || [];
  const totalCount = queryResult.data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const extensionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ext of extensions) {
      if (ext.extension_number) {
        map.set(ext.extension_number, ext.api4com_first_name || ext.label || ext.extension_number);
      }
    }
    return map;
  }, [extensions]);

  // Client-side filters for origin and search
  const filteredHistory = useMemo(() => {
    return serverData.filter((call: any) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const qDigits = filters.search.replace(/\D/g, '');
        const calledClean = (call.called || '').replace(/\D/g, '');
        const callerClean = (call.caller || '').replace(/\D/g, '');
        const extKey = call.extension_number || call.caller || '';
        const attendant = (extensionNameMap.get(extKey) || '').toLowerCase();
        const matchNumber = qDigits && (calledClean.includes(qDigits) || callerClean.includes(qDigits));
        const matchName = attendant.includes(q) || (call.cod_agent || '').toLowerCase().includes(q);
        if (!matchNumber && !matchName) return false;
      }
      if (originFilter !== 'all') {
        const meta = call.metadata || {};
        const origin = meta?.origin || 'MANUAL';
        if (originFilter !== origin) return false;
      }
      return true;
    });
  }, [serverData, filters.search, originFilter, extensionNameMap]);

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

          {queryResult.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Agente</TableHead>
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
                  {filteredHistory.map((call: any) => {
                    const meta = call.metadata || {};
                    const origin = meta?.origin as string | undefined;
                    const whatsappNumber = meta?.whatsapp_number as string | undefined;
                    const extName = extensionNameMap.get(call.extension_number || call.caller || '') || '';
                    const hasDuration = call.duration_seconds != null && call.duration_seconds > 0;

                    // Find agent name
                    const agentUp = userPlans.find(u => u.cod_agent === call.cod_agent && u.is_active);
                    const agentLabel = agentUp?.client_name || call.cod_agent || '-';

                    return (
                      <TableRow key={call.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {origin === 'CRM' ? (
                            <div className="flex items-center gap-1">
                              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                              <span>CRM</span>
                              {whatsappNumber && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleGoToCrm(whatsappNumber)} title="Ver no CRM">
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
                          <div>
                            <span className="font-medium">{agentLabel}</span>
                            <span className="block text-[10px] text-muted-foreground font-mono">{call.cod_agent}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{extName || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{call.extension_number || '-'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatPhone(call.called)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {call.started_at ? new Date(call.started_at).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {call.ended_at ? new Date(call.ended_at).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{formatDuration(call.duration_seconds || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={getHangupBadgeVariant(call.hangup_cause)} className="text-[10px] whitespace-nowrap">
                            {formatHangupCause(call.hangup_cause)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {call.direction === 'outbound' ? (
                            <span className="flex items-center gap-1">
                              <PhoneOutgoing className="h-3.5 w-3.5 text-primary" /> Saída
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <PhoneIncoming className="h-3.5 w-3.5 text-primary" /> Recebida
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {call.record_url ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlayingUrl(call.record_url)} disabled={!hasDuration} title={!hasDuration ? 'Sem gravação disponível' : 'Reproduzir gravação'}>
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
                      <TableCell colSpan={11} className="text-center text-muted-foreground">Nenhuma chamada encontrada</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <span className="text-xs text-muted-foreground">{totalCount} registro(s) no total</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
