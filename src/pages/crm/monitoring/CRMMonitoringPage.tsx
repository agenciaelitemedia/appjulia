import { useState, useEffect, useRef } from 'react';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';
import { CRMFiltersState } from '../types';
import { useCRMAgents } from '../hooks/useCRMData';
import { 
  useCRMStuckLeads, 
  useCRMRecentActivity, 
  useCRMAgentWorkload,
  useCRMStageBottlenecks 
} from '../hooks/useCRMMonitoring';
import { CRMFilters } from '../components/CRMFilters';
import { StuckLeadsAlert } from './components/StuckLeadsAlert';
import { ActivityTimeline } from './components/ActivityTimeline';
import { AgentWorkloadChart } from './components/AgentWorkloadChart';
import { StageBottlenecks } from './components/StageBottlenecks';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Activity, Users, Gauge } from 'lucide-react';

export default function CRMMonitoringPage() {
  const today = getTodayInSaoPaulo();
  const didInitAgentsRef = useRef(false);
  
  const [filters, setFilters] = useState<CRMFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: today,
    dateTo: today,
  });

  const { data: agents = [], isLoading: agentsLoading } = useCRMAgents();
  const { data: stuckLeads = [], isLoading: stuckLoading } = useCRMStuckLeads(filters);
  const { data: recentActivity = [], isLoading: activityLoading } = useCRMRecentActivity(filters);
  const { data: agentWorkload = [], isLoading: workloadLoading } = useCRMAgentWorkload(filters);
  const { data: bottlenecks = [], isLoading: bottlenecksLoading } = useCRMStageBottlenecks(filters);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Monitoramento do CRM</h1>
        <p className="text-muted-foreground">
          Alertas de leads parados, timeline de atividades e carga por agente
        </p>
      </div>

      {/* Filters */}
      <CRMFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={agentsLoading}
      />

      {/* Alerts and Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stuck Leads Alert */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">
              Leads Parados ({stuckLeads.length})
            </h2>
          </div>
          <StuckLeadsAlert leads={stuckLeads} isLoading={stuckLoading} />
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Atividades Recentes</h2>
          </div>
          <ActivityTimeline activities={recentActivity} isLoading={activityLoading} />
        </div>
      </div>

      {/* Workload and Bottlenecks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Workload */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Carga por Agente</h2>
          </div>
          <AgentWorkloadChart data={agentWorkload} isLoading={workloadLoading} />
        </div>

        {/* Stage Bottlenecks */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Gargalos por Estágio</h2>
          </div>
          <StageBottlenecks data={bottlenecks} isLoading={bottlenecksLoading} />
        </div>
      </div>
    </div>
  );
}
