import { useState, useMemo, useEffect, useRef } from 'react';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { CRMHeader } from './components/CRMHeader';
import { CRMDashboardSummary } from './components/CRMDashboardSummary';
import { CRMTotalizers } from './components/CRMTotalizers';
import { CRMFilters } from './components/CRMFilters';
import { CRMPipeline } from './components/CRMPipeline';
import { CRMLeadDetailsDialog } from './components/CRMLeadDetailsDialog';
import { useCRMStages, useCRMCards, useCRMAgents } from './hooks/useCRMData';
import { CRMCard, CRMFiltersState } from './types';
import { Skeleton } from '@/components/ui/skeleton';

export default function CRMPage() {
  const today = getTodayInSaoPaulo();
  const didInitAgentsRef = useRef(false);
  
  const [filters, setFilters] = useState<CRMFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
  });
  
  const [selectedCard, setSelectedCard] = useState<CRMCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: cards = [], isLoading: cardsLoading, refetch } = useCRMCards(filters);

  // Initialize agentCodes when agents load
  useEffect(() => {
    // Importante: inicializa só uma vez.
    // Se o usuário desmarcar tudo, NÃO devemos repopular automaticamente.
    if (!didInitAgentsRef.current && agents.length > 0 && filters.agentCodes.length === 0) {
      setFilters((prev) => ({
        ...prev,
        agentCodes: agents.map((a) => a.cod_agent),
      }));
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

  const handleRefresh = () => {
    refetch();
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
      <CRMHeader onRefresh={handleRefresh} isLoading={cardsLoading} />

      <CRMDashboardSummary cards={filteredCards} stages={stages} isLoading={cardsLoading} />

      <CRMTotalizers cards={filteredCards} stages={stages} />

      <CRMFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
      />

      <CRMPipeline
        stages={stages}
        cards={filteredCards}
        onCardClick={handleCardClick}
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
