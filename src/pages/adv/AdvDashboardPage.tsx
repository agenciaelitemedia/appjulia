import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useJuliaContratos, useJuliaContratosPrevious } from '@/pages/estrategico/hooks/useJuliaData';
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { ContratosSummary } from '@/pages/estrategico/contratos/components/ContratosSummary';
import { ContratosTable } from '@/pages/estrategico/contratos/components/ContratosTable';
import { ContratoDetailsDialog } from '@/pages/estrategico/contratos/components/ContratoDetailsDialog';
import { ContratosEvolutionChart } from '@/pages/estrategico/contratos/components/ContratosEvolutionChart';
import { JuliaContrato } from '@/pages/estrategico/types';
import { getInitialDates } from '@/hooks/usePersistedPeriod';

export default function AdvDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const firstName = user?.name?.split(' ')[0] || 'Advogado';
  const agentCode = user?.cod_agent ? String(user.cod_agent) : '';

  const initialDates = getInitialDates();
  const [filters, setFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: agentCode ? [agentCode] : [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<JuliaContrato | null>(null);

  const { data: contratos = [], isLoading: contratosLoading } = useJuliaContratos({
    ...filters,
    agentCodes: agentCode ? [agentCode] : [],
    statusDocument: filters.statusDocument,
  });
  const { data: previousContratos = [] } = useJuliaContratosPrevious({
    ...filters,
    agentCodes: agentCode ? [agentCode] : [],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['julia-contratos-previous'] }),
    ]);
    setIsRefreshing(false);
  };

  const handleFiltersChange = (newFilters: UnifiedFiltersState) => {
    setFilters({ ...newFilters, agentCodes: agentCode ? [agentCode] : [] });
  };

  if (!agentCode) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <p className="text-muted-foreground text-sm text-center">
          Nenhum agente vinculado ao seu perfil. Contate o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Seus contratos</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <UnifiedFilters
        agents={[]}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        showAgentSelector={false}
        showSearch={false}
        showStatusFilter
        statusOptions={['CREATED', 'SIGNED', 'PENDING', 'CANCELLED']}
      />

      {/* Summary */}
      <ContratosSummary
        contratos={contratos}
        previousContratos={previousContratos}
        isLoading={contratosLoading}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
      />

      {/* Chart */}
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

      {/* Details */}
      <ContratoDetailsDialog
        contrato={selectedContrato}
        open={!!selectedContrato}
        onOpenChange={(open) => !open && setSelectedContrato(null)}
      />
    </div>
  );
}
