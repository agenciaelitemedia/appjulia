import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useJuliaAgents, useJuliaSessoes, useJuliaSessoesPrevious } from '../hooks/useJuliaData';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { DesempenhoSummary } from './components/DesempenhoSummary';
import { DesempenhoEvolutionChart } from './components/DesempenhoEvolutionChart';
import { DesempenhoTable } from './components/DesempenhoTable';
import { getInitialDates } from '@/hooks/usePersistedPeriod';

export default function DesempenhoPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

  const initialDates = getInitialDates();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
    perfilAgent: 'ALL',
  });

  const { data: agents = [], isLoading: agentsLoading } = useJuliaAgents();
  const { data: sessoes = [], isLoading: sessoesLoading } = useJuliaSessoes({
    ...filters,
    perfilAgent: filters.perfilAgent as 'SDR' | 'CLOSER' | 'ALL',
  });
  const { data: previousSessoes = [] } = useJuliaSessoesPrevious({
    ...filters,
    perfilAgent: filters.perfilAgent as 'SDR' | 'CLOSER' | 'ALL',
  });

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
      queryClient.invalidateQueries({ queryKey: ['julia-sessoes'] }),
      queryClient.invalidateQueries({ queryKey: ['julia-sessoes-previous'] }),
    ]);
    setIsRefreshing(false);
  };

  if (agentsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Desempenho Julia</h1>
          <p className="text-muted-foreground">
            Acompanhe as sessões de atendimento da IA Julia
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

      {/* Filters - Now at the top after header */}
      <UnifiedFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        showPerfilFilter
      />

      {/* Summary Cards */}
      <DesempenhoSummary 
        sessoes={sessoes} 
        previousSessoes={previousSessoes}
        isLoading={sessoesLoading}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Evolution Chart */}
      <DesempenhoEvolutionChart 
        sessoes={sessoes} 
        isLoading={sessoesLoading}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Table */}
      <DesempenhoTable
        sessoes={sessoes}
        isLoading={sessoesLoading}
        searchTerm={filters.search}
      />
    </div>
  );
}
