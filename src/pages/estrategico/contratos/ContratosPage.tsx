import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useJuliaAgents, useJuliaContratos, useJuliaContratosPrevious } from '../hooks/useJuliaData';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { ContratosSummary } from './components/ContratosSummary';
import { ContratosTable } from './components/ContratosTable';
import { ContratoDetailsDialog } from './components/ContratoDetailsDialog';
import { ContratosEvolutionChart } from './components/ContratosEvolutionChart';
import { JuliaContrato } from '../types';
import { getInitialDates } from '@/hooks/usePersistedPeriod';

export default function ContratosPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);
  const hasInitializedFilters = useRef(false);

  const initialDates = getInitialDates();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
  });

  const { data: agents = [], isLoading: agentsLoading } = useJuliaAgents();
  const { data: contratos = [], isLoading: contratosLoading } = useJuliaContratos({
    ...filters,
    statusDocument: filters.statusDocument,
  });
  const { data: previousContratos = [] } = useJuliaContratosPrevious(filters);

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
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-previous'] }),
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
          <h1 className="text-2xl font-bold">Contratos Julia</h1>
          <p className="text-muted-foreground">
            Acompanhe os contratos gerados pela IA Julia
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
        showStatusFilter
        statusOptions={['CREATED', 'SIGNED', 'PENDING', 'CANCELLED']}
      />

      {/* Summary Cards */}
      <ContratosSummary 
        contratos={contratos} 
        previousContratos={previousContratos}
        isLoading={contratosLoading}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Evolution Chart */}
      <ContratosEvolutionChart 
        contratos={contratos} 
        isLoading={contratosLoading}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Table */}
      <ContratosTable
        contratos={contratos}
        isLoading={contratosLoading}
        searchTerm={filters.search}
        onViewDetails={setSelectedContrato}
      />

      {/* Details Dialog */}
      <ContratoDetailsDialog
        contrato={selectedContrato}
        open={!!selectedContrato}
        onOpenChange={(open) => !open && setSelectedContrato(null)}
      />
    </div>
  );
}
