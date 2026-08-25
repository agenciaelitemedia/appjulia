import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, LayoutDashboard, List, Users, LayoutGrid } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { STORAGE_KEYS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { getInitialDates, getSavedAgentCodes } from '@/hooks/usePersistedPeriod';
import {
  useCampanhasAgents,
  useCampanhasLeads,
  useCampanhasRaw,
  useCampanhasFunnel,
  useCampanhasFunnelPrevious,
  useCampanhasByPlatform,
  useCampanhasEvolution,
  useCampanhasHeatmap,
  useCampanhasSummary,
} from './hooks/useCampanhasData';
import { useCampanhasConversionEvolution } from './hooks/useCampanhasConversionEvolution';
import { CampanhasFunnelChart } from './components/CampanhasFunnelChart';
import { CampanhasByPlatform } from './components/CampanhasByPlatform';
import { CampanhasEvolutionChart } from './components/CampanhasEvolutionChart';
import { CampanhasConversionEvolutionChart } from './components/CampanhasConversionEvolutionChart';
import { CampanhasHeatmap } from './components/CampanhasHeatmap';
import { CampanhasTopTable } from './components/CampanhasTopTable';
import { CampanhasListTab } from './components/CampanhasListTab';
import { CampanhasLeadsTab } from './components/CampanhasLeadsTab';

export default function CampanhasPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

  // Preferência de exibição dos cards do dashboard de campanhas (persistida no navegador)
  const [cardLayout, setCardLayout] = useState<'grid' | 'full'>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CAMPANHAS_CARD_LAYOUT) === 'full' ? 'full' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleCardLayoutChange = (next: 'grid' | 'full') => {
    setCardLayout(next);
    try {
      localStorage.setItem(STORAGE_KEYS.CAMPANHAS_CARD_LAYOUT, next);
    } catch {
      /* ignore */
    }
  };

  const initialDates = getInitialDates();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
  });

  // Data hooks
  const { data: agents = [], isLoading: agentsLoading } = useCampanhasAgents();
  const { data: leadsData = [], isLoading: leadsLoading } = useCampanhasLeads(filters);
  const { data: rawData = [], isLoading: rawLoading } = useCampanhasRaw(filters);
  const { data: funnelData = [], isLoading: funnelLoading } = useCampanhasFunnel(filters);
  const { data: funnelPreviousData = [] } = useCampanhasFunnelPrevious(filters);
  const { data: platformData = [], isLoading: platformLoading } = useCampanhasByPlatform(filters);
  const { data: evolutionData = [], isLoading: evolutionLoading } = useCampanhasEvolution(filters);
  const { data: conversionEvolutionData = [], isLoading: conversionEvolutionLoading } = useCampanhasConversionEvolution(filters);
  const { data: heatmapData = [], isLoading: heatmapLoading } = useCampanhasHeatmap(filters);
  const summary = useCampanhasSummary(filters);

  const isLoading = leadsLoading || rawLoading;

  // Initialize agent codes when agents load
  useEffect(() => {
    if (agents.length > 0 && !hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      const saved = getSavedAgentCodes();
      const agentCodes = saved !== null
        ? saved.filter(code => agents.some(a => a.cod_agent === code))
        : agents.map((a) => a.cod_agent);
      setFilters((prev) => ({ ...prev, agentCodes }));
    }
  }, [agents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['campanhas-leads'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-raw'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-funnel'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-funnel-previous'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-by-platform'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-evolution'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-conversion-evolution'] }),
      queryClient.invalidateQueries({ queryKey: ['campanhas-heatmap'] }),
    ]);
    setIsRefreshing(false);
  };

  if (agentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas Ads</h1>
          <p className="text-muted-foreground">
            Análise estratégica de campanhas de anúncios e geração de leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <div className="flex gap-1">
            <Toggle
              pressed={cardLayout === 'grid'}
              onPressedChange={() => handleCardLayoutChange('grid')}
              aria-label="Exibição padrão em blocos"
              size="sm"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={cardLayout === 'full'}
              onPressedChange={() => handleCardLayoutChange('full')}
              aria-label="Exibição em lista (linha inteira)"
              size="sm"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Filters - shared between tabs */}
      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        searchPlaceholder="Buscar campanhas..."
      />

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <List className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-0">
          {/* Main Charts Row */}
          <div className={cardLayout === 'full' ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
            {/* Funnel Chart - Highlight */}
            <CampanhasFunnelChart data={funnelData} previousData={funnelPreviousData} isLoading={funnelLoading} />
            
            {/* Platform Distribution */}
            <CampanhasByPlatform data={platformData} isLoading={platformLoading} />
          </div>

          {/* Evolution Chart - Full Width */}
          <CampanhasEvolutionChart 
            data={evolutionData} 
            isLoading={evolutionLoading}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />

          {/* Conversion Evolution Chart - Full Width */}
          <CampanhasConversionEvolutionChart 
            data={conversionEvolutionData} 
            isLoading={conversionEvolutionLoading}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />

          {/* Secondary Row */}
          <div className={cardLayout === 'full' ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
            {/* Heatmap */}
            <div className={cardLayout === 'full' ? '' : 'lg:col-span-1'}>
              <CampanhasHeatmap data={heatmapData} isLoading={heatmapLoading} />
            </div>
            
            {/* Top Campaigns Table */}
            <div className={cardLayout === 'full' ? '' : 'lg:col-span-2'}>
              <CampanhasTopTable 
                data={leadsData} 
                isLoading={leadsLoading}
                searchTerm={filters.search}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campanhas" className="mt-0">
          <CampanhasListTab filters={filters} />
        </TabsContent>

        <TabsContent value="leads" className="mt-0">
          <CampanhasLeadsTab filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
