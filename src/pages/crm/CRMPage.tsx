import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CRMHeader } from './components/CRMHeader';
import { CRMDashboardSummary } from './components/CRMDashboardSummary';
import { CRMTotalizers } from './components/CRMTotalizers';
import { CRMPipeline } from './components/CRMPipeline';
import { CRMLeadDetailsDialog } from './components/CRMLeadDetailsDialog';
import { useCRMStages, useCRMCards, useCRMAgents, useCRMJuliaSessions } from './hooks/useCRMData';
import { useFollowupActiveLeads } from './hooks/useFollowupActiveLeads';
import { useFollowupReturnRate } from './hooks/useFollowupReturnRate';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { CRMCard } from './types';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitialDates, getSavedAgentCodes } from '@/hooks/usePersistedPeriod';

export default function CRMPage() {
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

  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: cards = [], isLoading: cardsLoading, refetch } = useCRMCards(filters);
  const { data: juliaSessions } = useCRMJuliaSessions(filters);
  const { data: followupMap = new Map() } = useFollowupActiveLeads(filters.agentCodes, filters.dateFrom, filters.dateTo);
  const { data: returnRateData } = useFollowupReturnRate(filters.agentCodes, filters.dateFrom, filters.dateTo);

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

  // Apply search filter on client side
  const filteredCards = useMemo(() => {
    if (!filters.search) return cards;

    const search = filters.search.toLowerCase();
    return cards.filter(
      (card) =>
        card.contact_name?.toLowerCase().includes(search) ||
        card.whatsapp_number?.includes(filters.search) ||
        card.business_name?.toLowerCase().includes(search) ||
        card.helena_count_id?.toLowerCase().includes(search)
    );
  }, [cards, filters.search]);

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

      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        periodTooltip="Filtra pela data da última movimentação do lead no pipeline (não pela data de criação)"
      />

      <CRMDashboardSummary cards={filteredCards} stages={stages} isLoading={cardsLoading} juliaSessions={juliaSessions} followupMap={followupMap} />

      <CRMTotalizers cards={filteredCards} stages={stages} />

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
