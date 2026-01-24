import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { useJuliaAgents, useJuliaSessoes } from '../hooks/useJuliaData';
import { JuliaFilters } from '../components/JuliaFilters';
import { DesempenhoSummary } from './components/DesempenhoSummary';
import { DesempenhoTable } from './components/DesempenhoTable';
import { JuliaFiltersState } from '../types';

export default function DesempenhoPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedFilters = useRef(false);

  const today = getTodayInSaoPaulo();
  const [filters, setFilters] = useState<JuliaFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
    perfilAgent: 'ALL',
  });

  const { data: agents = [], isLoading: agentsLoading } = useJuliaAgents();
  const { data: sessoes = [], isLoading: sessoesLoading } = useJuliaSessoes(filters);

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
    await queryClient.invalidateQueries({ queryKey: ['julia-sessoes'] });
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

      {/* Summary Cards */}
      <DesempenhoSummary sessoes={sessoes} isLoading={sessoesLoading} />

      {/* Filters */}
      <JuliaFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
        showPerfilFilter
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
