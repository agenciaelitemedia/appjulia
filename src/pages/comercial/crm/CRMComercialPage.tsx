import { useState, useMemo } from 'react';
import { Briefcase, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { useCrmComercialStages, useCrmComercialCards } from './hooks/useCrmComercialData';
import { useCRMAgents } from '@/pages/crm/hooks/useCRMData';
import { ComercialTotalizers } from './components/ComercialTotalizers';
import { ComercialPipeline } from './components/ComercialPipeline';
import { ComercialCardDialog } from './components/ComercialCardDialog';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import type { UnifiedFiltersState } from '@/components/filters/types';
import type { ComercialCard } from './types';

export default function CRMComercialPage() {
  const queryClient = useQueryClient();
  const today = getTodayInSaoPaulo();

  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: '',
    dateTo: '',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ComercialCard | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stages = [], isLoading: stagesLoading } = useCrmComercialStages();
  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: cards = [], isLoading: cardsLoading } = useCrmComercialCards({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    agentCodes: filters.agentCodes,
  });

  const filteredCards = useMemo(() => {
    if (!filters.search) return cards;
    const s = filters.search.toLowerCase();
    return cards.filter(
      (c) =>
        c.contact_name?.toLowerCase().includes(s) ||
        c.contact_phone?.includes(filters.search) ||
        c.contact_email?.toLowerCase().includes(s) ||
        c.company_name?.toLowerCase().includes(s)
    );
  }, [cards, filters.search]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['crm-comercial-cards'] });
    setIsRefreshing(false);
  };

  const handleCardClick = (card: ComercialCard) => {
    setSelectedCard(card);
    setDialogOpen(true);
  };

  const handleNewCard = () => {
    setSelectedCard(null);
    setDialogOpen(true);
  };

  if (stagesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-96 min-w-[280px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">CRM Comercial</h1>
            <p className="text-sm text-muted-foreground">Pipeline de vendas e oportunidades</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleNewCard}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Card
          </Button>
        </div>
      </div>

      {/* Filters */}
      <UnifiedFilters
        agents={agents.map((a) => ({
          cod_agent: a.cod_agent,
          owner_name: a.owner_name || a.cod_agent,
          owner_business_name: a.owner_business_name,
        }))}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading || cardsLoading}
        showAgentSelector
        showSearch
        showQuickPeriods
        searchPlaceholder="Buscar por nome, telefone, email, empresa..."
      />

      {/* Totalizers */}
      <ComercialTotalizers cards={filteredCards} stages={stages} />

      {/* Pipeline */}
      <ComercialPipeline stages={stages} cards={filteredCards} onCardClick={handleCardClick} />

      {/* Dialog */}
      <ComercialCardDialog open={dialogOpen} onOpenChange={setDialogOpen} stages={stages} card={selectedCard} />
    </div>
  );
}
