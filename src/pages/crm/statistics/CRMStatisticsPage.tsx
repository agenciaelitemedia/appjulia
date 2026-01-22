import { useState, useEffect, useRef } from 'react';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { CRMFiltersState } from '../types';
import { useCRMAgents } from '../hooks/useCRMData';
import { useCRMFunnelData, useCRMAvgTimeByStage, useCRMAgentPerformance } from '../hooks/useCRMStatistics';
import { CRMFilters } from '../components/CRMFilters';
import { ConversionFunnelChart } from './components/ConversionFunnelChart';
import { AverageTimeChart } from './components/AverageTimeChart';
import { AgentPerformanceTable } from './components/AgentPerformanceTable';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Clock, Users } from 'lucide-react';

export default function CRMStatisticsPage() {
  const today = getTodayInSaoPaulo();
  const didInitAgentsRef = useRef(false);
  
  // Default to last 30 days for statistics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
  
  const [filters, setFilters] = useState<CRMFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: dateFrom,
    dateTo: today,
  });

  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: funnelData = [], isLoading: funnelLoading } = useCRMFunnelData(filters);
  const { data: avgTimeData = [], isLoading: avgTimeLoading } = useCRMAvgTimeByStage(filters);
  const { data: agentPerformance = [], isLoading: performanceLoading } = useCRMAgentPerformance(filters);

  // Initialize agentCodes when agents load
  useEffect(() => {
    if (!didInitAgentsRef.current && agents.length > 0 && filters.agentCodes.length === 0) {
      setFilters((prev) => ({
        ...prev,
        agentCodes: agents.map((a) => a.cod_agent),
      }));
      didInitAgentsRef.current = true;
    }
  }, [agents, filters.agentCodes.length]);

  const isLoading = agentsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estatísticas do CRM</h1>
        <p className="text-muted-foreground">
          Análise de funil de conversão, tempo médio e performance por agente
        </p>
      </div>

      {/* Filters */}
      <CRMFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Funil de Conversão</h2>
          </div>
          <ConversionFunnelChart data={funnelData} isLoading={funnelLoading} />
        </div>

        {/* Average Time */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Tempo Médio por Estágio</h2>
          </div>
          <AverageTimeChart data={avgTimeData} isLoading={avgTimeLoading} />
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Performance por Agente</h2>
        </div>
        <AgentPerformanceTable data={agentPerformance} isLoading={performanceLoading} />
      </div>
    </div>
  );
}
