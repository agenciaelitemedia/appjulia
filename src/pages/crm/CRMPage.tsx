import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, UserCircle } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { CRMHeader } from './components/CRMHeader';
import { CRMDashboardSummary } from './components/CRMDashboardSummary';
import { CRMTotalizers } from './components/CRMTotalizers';
import { CRMPipeline } from './components/CRMPipeline';
import { CRMLeadDetailsDialog } from './components/CRMLeadDetailsDialog';
import { useCRMStages, useCRMCards, useCRMAgents, useCRMJuliaSessions, useCRMJuliaConversations, useTeamForAgent } from './hooks/useCRMData';
import { useFollowupActiveLeads } from './hooks/useFollowupActiveLeads';
import { useFollowupReturnRate } from './hooks/useFollowupReturnRate';
import { useAgentSessionStatusesBatch } from '@/hooks/useAgentSessionStatusesBatch';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { CRMCard } from './types';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitialDates, getSavedAgentCodes } from '@/hooks/usePersistedPeriod';

export default function CRMPage() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDates = getInitialDates();
  const didInitAgentsRef = useRef(false);

  // Check if we have a whatsapp param from campaigns navigation
  const whatsappParam = searchParams.get('whatsapp');
  
  const [filters, setFilters] = useState<UnifiedFiltersState>(() => {
    if (whatsappParam) {
      return {
        search: whatsappParam,
        agentCodes: [],
        dateFrom: '',
        dateTo: '',
      };
    }
    return {
      search: '',
      agentCodes: [],
      dateFrom: initialDates.dateFrom,
      dateTo: initialDates.dateTo,
    };
  });
  
  const [selectedCard, setSelectedCard] = useState<CRMCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [juliaStatusFilter, setJuliaStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: cards = [], isLoading: cardsLoading, refetch } = useCRMCards(filters);
  const { data: juliaSessions } = useCRMJuliaSessions(filters);
  const { data: juliaConversations } = useCRMJuliaConversations(filters);
  const { data: followupMap = new Map() } = useFollowupActiveLeads(filters.agentCodes, filters.dateFrom, filters.dateTo);
  const { data: returnRateData } = useFollowupReturnRate(filters.agentCodes, filters.dateFrom, filters.dateTo);
  const firstAgentCode = filters.agentCodes.length === 1 ? filters.agentCodes[0] : filters.agentCodes[0] || null;
  const { data: teamMembers = [] } = useTeamForAgent(firstAgentCode);

  // Batch fetch de status de sessão Julia para todos os cards de uma vez,
  // para que o filtro Julia ativa/inativa tenha contagem correta já no 1º clique.
  const sessionPairs = useMemo(
    () =>
      cards
        .filter((c) => c.whatsapp_number && c.cod_agent)
        .map((c) => ({ whatsappNumber: c.whatsapp_number, codAgent: String(c.cod_agent) })),
    [cards]
  );
  const { data: sessionStatusMap, isLoading: sessionStatusLoading } =
    useAgentSessionStatusesBatch(sessionPairs);

  // Clean up whatsapp param from URL after consuming it
  useEffect(() => {
    if (whatsappParam) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize agentCodes when agents load
  useEffect(() => {
    if (!didInitAgentsRef.current && agents.length > 0 && filters.agentCodes.length === 0) {
      const saved = getSavedAgentCodes();
      const agentCodes = saved !== null
        ? saved.filter(code => agents.some(a => a.cod_agent === code))
        : agents.map((a) => a.cod_agent);
      setFilters((prev) => ({ ...prev, agentCodes }));
      didInitAgentsRef.current = true;
    }
  }, [agents, filters.agentCodes.length]);

  const isLoading = stagesLoading || agentsLoading;

  // Apply search + Julia status filter on client side
  const filteredCards = useMemo(() => {
    let result = cards;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (card) =>
          card.contact_name?.toLowerCase().includes(search) ||
          card.whatsapp_number?.includes(filters.search) ||
          card.business_name?.toLowerCase().includes(search) ||
          card.helena_count_id?.toLowerCase().includes(search)
      );
    }

    if (juliaStatusFilter !== 'all') {
      // Enquanto o batch ainda carrega, evita filtrar (não pisca contagem).
      if (sessionStatusLoading || !sessionStatusMap) {
        // no-op
      } else {
        result = result.filter((card) => {
          const digits = String(card.whatsapp_number || '').replace(/\D/g, '');
          const codAgent = String(card.cod_agent || '');
          if (!digits || !codAgent) {
            return juliaStatusFilter === 'inactive';
          }
          const isActive = sessionStatusMap.get(`${digits}:${codAgent}`) ?? false;
          return juliaStatusFilter === 'active' ? isActive : !isActive;
        });
      }
    }

    // Owner filter
    if (ownerFilter !== 'all') {
      if (ownerFilter === 'mine') {
        result = result.filter((card) => card.owner_name === authUser?.name);
      } else if (ownerFilter === 'unassigned') {
        result = result.filter((card) => !card.owner_name);
      } else {
        result = result.filter((card) => card.owner_name === ownerFilter);
      }
    }

    return result;
  }, [cards, filters.search, juliaStatusFilter, ownerFilter, authUser?.name, sessionStatusMap, sessionStatusLoading]);

  const handleCardClick = (card: CRMCard) => {
    setSelectedCard(card);
    setDialogOpen(true);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['crm-cards'] });
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>

        <Skeleton className="h-12 w-full" />

        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-96 min-w-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <CRMHeader onRefresh={handleRefresh} isLoading={isRefreshing} />

      <CRMDashboardSummary cards={filteredCards} stages={stages} isLoading={cardsLoading} juliaSessions={juliaSessions} juliaConversations={juliaConversations} followupMap={followupMap} returnRateData={returnRateData} />

      <CRMTotalizers cards={filteredCards} stages={stages} />

      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        periodTooltip="Filtra pela data da última movimentação do lead no pipeline (não pela data de criação)"
        defaultOpen={false}
        showPeriodInHeader
      />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <ToggleGroup
            type="single"
            value={juliaStatusFilter}
            onValueChange={(val) => { if (val) setJuliaStatusFilter(val as 'all' | 'active' | 'inactive'); }}
            size="sm"
          >
            <ToggleGroupItem value="all" className="text-xs px-3">
              Todas
            </ToggleGroupItem>
            <ToggleGroupItem value="active" className="text-xs px-3 data-[state=on]:bg-green-100 data-[state=on]:text-green-700 dark:data-[state=on]:bg-green-900/30 dark:data-[state=on]:text-green-400">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
              Julia
            </ToggleGroupItem>
            <ToggleGroupItem value="inactive" className="text-xs px-3 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 dark:data-[state=on]:bg-red-900/30 dark:data-[state=on]:text-red-400">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
              Atendimento Humano
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              <SelectItem value="mine" className="text-xs font-bold uppercase tracking-wide text-primary">
                MEUS CARDS
              </SelectItem>
              <SelectItem value="unassigned" className="text-xs text-muted-foreground italic">
                Sem Responsável
              </SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.name} className="text-xs">
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CRMPipeline
        stages={stages}
        cards={filteredCards}
        onCardClick={handleCardClick}
         followupMap={followupMap}
      />

      <CRMLeadDetailsDialog
        card={selectedCard}
        stages={stages}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
