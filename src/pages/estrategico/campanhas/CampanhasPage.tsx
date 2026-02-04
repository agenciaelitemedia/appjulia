import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, LayoutDashboard, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { getInitialDates } from '@/hooks/usePersistedPeriod';
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
import { CampanhasSummary } from './components/CampanhasSummary';
import { CampanhasFunnelChart } from './components/CampanhasFunnelChart';
import { CampanhasByPlatform } from './components/CampanhasByPlatform';
import { CampanhasEvolutionChart } from './components/CampanhasEvolutionChart';
import { CampanhasConversionEvolutionChart } from './components/CampanhasConversionEvolutionChart';
import { CampanhasHeatmap } from './components/CampanhasHeatmap';
import { CampanhasTopTable } from './components/CampanhasTopTable';
import { CampanhasListTab } from './components/CampanhasListTab';

export default function CampanhasPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

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
      setFilters((prev) => ({
        ...prev,
        agentCodes: agents.map((a) => a.cod_agent),
      }));
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
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
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-0">
          {/* Summary Cards */}
          <CampanhasSummary summary={summary} isLoading={isLoading} />

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Chart - Highlight */}
            <CampanhasFunnelChart data={funnelData} isLoading={funnelLoading} />
            
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Heatmap */}
            <div className="lg:col-span-1">
              <CampanhasHeatmap data={heatmapData} isLoading={heatmapLoading} />
            </div>
            
            {/* Top Campaigns Table */}
            <div className="lg:col-span-2">
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
      </Tabs>
    </div>
  );
}
