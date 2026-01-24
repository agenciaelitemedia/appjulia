import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LayoutDashboard, List, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/contexts/AuthContext';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import {
  useFollowupConfig,
  useSaveFollowupConfig,
  useFollowupQueue,
  useFollowupSentCount,
  useUpdateQueueState,
  useRestartQueueItem,
  useFinalizeQueueItem,
  useFollowupDailyMetrics,
  useFollowupReturnRate,
  useFollowupQueueTotals,
  useFollowupPreviousPeriodStats,
} from '../hooks/useFollowupData';
import { 
  FollowupFiltersState, 
  FollowupConfig as FollowupConfigType, 
  FollowupQueueItem,
  FollowupQueueItemEnriched,
  FollowupStats,
} from '../types';

import { FollowupDashboard } from './components/FollowupDashboard';
import { FollowupConfig } from './components/FollowupConfig';
import { FollowupQueue } from './components/FollowupQueue';
import { FollowupFilters } from './components/FollowupFilters';
import { getTodayInSaoPaulo, get7DaysAgoInSaoPaulo } from '@/lib/dateUtils';

// Helper to parse JSON fields that might be strings or objects
function parseJsonField<T>(field: string | T | null | undefined, defaultValue: T): T {
  if (!field) return defaultValue;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return defaultValue;
    }
  }
  return field as T;
}

// Derive status based on current step, total steps, original state, and infinite mode
function getDerivedStatus(
  item: FollowupQueueItem, 
  totalSteps: number,
  isInfinite: boolean
): 'sent' | 'waiting' | 'stopped' | 'finalized' {
  // Finalized: step_number = 0 and state = STOP
  if (item.state === 'STOP' && item.step_number === 0) return 'finalized';
  if (item.state === 'STOP') return 'stopped';
  // If infinite, never consider as "sent" (always loops back)
  if (!isInfinite && item.state === 'SEND' && item.step_number >= totalSteps) return 'sent';
  return 'waiting';
}

export default function FollowupPage() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard uses last 7 days by default
  const [dashboardDateFrom, setDashboardDateFrom] = useState<string>(get7DaysAgoInSaoPaulo());
  const [dashboardDateTo, setDashboardDateTo] = useState<string>(getTodayInSaoPaulo());
  
  // Queue uses today by default
  const [queueDateFrom, setQueueDateFrom] = useState<string>(getTodayInSaoPaulo());
  const [queueDateTo, setQueueDateTo] = useState<string>(getTodayInSaoPaulo());
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch agents
  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();

  // Set default agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      if (user?.role !== 'admin' && user?.cod_agent) {
        setSelectedAgent(String(user.cod_agent));
      } else {
        setSelectedAgent(agents[0].cod_agent);
      }
    }
  }, [agents, selectedAgent, user]);

  // Filters for dashboard (daily metrics)
  const dashboardFilters: FollowupFiltersState = useMemo(() => ({
    agentCodes: selectedAgent ? [selectedAgent] : [],
    dateFrom: dashboardDateFrom,
    dateTo: dashboardDateTo,
  }), [selectedAgent, dashboardDateFrom, dashboardDateTo]);

  // Filters for queue
  const queueFilters: FollowupFiltersState = useMemo(() => ({
    agentCodes: selectedAgent ? [selectedAgent] : [],
    dateFrom: queueDateFrom,
    dateTo: queueDateTo,
    state: stateFilter,
  }), [selectedAgent, queueDateFrom, queueDateTo, stateFilter]);

  // Fetch data
  const { data: configData, isLoading: isLoadingConfig, refetch: refetchConfig } = useFollowupConfig(selectedAgent);
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useFollowupQueue(queueFilters);
  const { data: totalSentCount = 0, refetch: refetchSentCount } = useFollowupSentCount(queueFilters);
  
  // Dashboard-specific data
  const { data: dailyMetrics = [], isLoading: isLoadingDailyMetrics, refetch: refetchDailyMetrics } = useFollowupDailyMetrics(dashboardFilters);
  const { data: returnData, refetch: refetchReturnRate } = useFollowupReturnRate(dashboardFilters);
  const { data: queueTotals, refetch: refetchQueueTotals } = useFollowupQueueTotals(dashboardFilters);
  
  // Previous period stats for comparison
  const { previous: previousStats, isLoading: isLoadingPrevious } = useFollowupPreviousPeriodStats(dashboardFilters);

  // Normalize config data
  const config: FollowupConfigType | null = useMemo(() => {
    if (!configData) return null;
    if (Array.isArray(configData)) return configData[0] || null;
    return configData;
  }, [configData]);

  // Extract step_cadence from config
  const stepCadence = useMemo(() => {
    if (!config?.step_cadence) return {};
    return parseJsonField<Record<string, string>>(config.step_cadence, {});
  }, [config]);

  // Calculate total steps and is_infinite from config
  const { totalSteps, isInfinite } = useMemo(() => {
    if (!config?.step_cadence) return { totalSteps: 3, isInfinite: false };
    const steps = Object.keys(stepCadence).length || 3;
    const infinite = config.followup_from !== null && config.followup_to !== null;
    return { totalSteps: steps, isInfinite: infinite };
  }, [config, stepCadence]);

  // Normalize and enrich queue items with derived status and is_infinite
  const enrichedQueueItems: FollowupQueueItemEnriched[] = useMemo(() => {
    if (!queueData) return [];
    const flattened = Array.isArray(queueData) ? queueData.flat() : [];
    
    return (flattened as FollowupQueueItem[]).map(item => ({
      ...item,
      total_steps: totalSteps,
      derived_status: getDerivedStatus(item, totalSteps, isInfinite),
      is_infinite: isInfinite,
    }));
  }, [queueData, totalSteps, isInfinite]);

  // Filter items by search term (client-side)
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return enrichedQueueItems;
    
    const search = searchTerm.toLowerCase();
    return enrichedQueueItems.filter((item) =>
      item.name_client?.toLowerCase().includes(search) ||
      item.session_id?.toLowerCase().includes(search)
    );
  }, [enrichedQueueItems, searchTerm]);

  // Calculate queue stats from filtered items
  const queueStats = useMemo(() => {
    const result = {
      waiting: 0,
      stopped: 0,
    };

    filteredItems.forEach(item => {
      if (item.derived_status === 'waiting') result.waiting++;
      else if (item.derived_status === 'stopped') result.stopped++;
    });

    return result;
  }, [filteredItems]);

  // Dashboard stats (using queue totals and return data) with previous period comparison
  const dashboardStats: FollowupStats = useMemo(() => {
    const total = queueTotals?.total || 0;
    const waiting = queueTotals?.waiting || 0;
    const followupRate = total > 0 ? (waiting / total) * 100 : 0;

    return {
      total,           // From followup_queue (any status)
      totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
      waiting,         // From followup_queue (state = 'SEND')
      stopped: returnData?.responses || 0,      // COUNT(*) from followup_response
      responseRate: returnData?.returnRate || 0, // Return Rate = (leads STOP + step<>0 with response / total) * 100
      lossRate: returnData?.lossRate || 0,      // Loss Rate = (leads STOP + step=0 / total) * 100
      followupRate,    // Followup Rate = (waiting / total) * 100
      previous: isLoadingPrevious ? undefined : previousStats,
    };
  }, [queueTotals, dailyMetrics, returnData, previousStats, isLoadingPrevious]);

  // Queue page stats (local to queue tab)
  const queuePageStats: FollowupStats = useMemo(() => {
    const total = filteredItems.length;
    const waiting = queueStats.waiting;
    const followupRate = total > 0 ? (waiting / total) * 100 : 0;

    return {
      total,
      totalSent: totalSentCount,
      waiting,
      stopped: queueStats.stopped,
      responseRate: total > 0 
        ? (queueStats.stopped / total) * 100 
        : 0,
      lossRate: 0, // Not calculated locally for queue page
      followupRate,
    };
  }, [filteredItems, totalSentCount, queueStats]);

  // Mutations
  const saveConfigMutation = useSaveFollowupConfig();
  const updateStateMutation = useUpdateQueueState();
  const restartItemMutation = useRestartQueueItem();
  const finalizeItemMutation = useFinalizeQueueItem();

  const handleSaveConfig = (configDataToSave: Partial<FollowupConfigType>) => {
    if (selectedAgent) {
      saveConfigMutation.mutate({
        ...configDataToSave,
        cod_agent: selectedAgent,
      });
    }
  };

  const handleUpdateState = (id: number, state: string) => {
    updateStateMutation.mutate({ id, state });
  };

  const handleRestart = (id: number) => {
    restartItemMutation.mutate(id);
  };

  const handleFinalize = (id: number) => {
    finalizeItemMutation.mutate(id);
  };

  const handleRefresh = () => {
    refetchConfig();
    refetchQueue();
    refetchSentCount();
    refetchDailyMetrics();
    refetchReturnRate();
    refetchQueueTotals();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FollowUp</h1>
          <p className="text-muted-foreground">
            Configure as cadências de reengajamento e monitore a fila de envios
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Agent Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="agent-select" className="text-sm whitespace-nowrap">
              Agente:
            </Label>
            <Select
              value={selectedAgent || ''}
              onValueChange={setSelectedAgent}
              disabled={isLoadingAgents}
            >
              <SelectTrigger id="agent-select" className="w-[200px]">
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.cod_agent} value={agent.cod_agent}>
                    {agent.owner_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <List className="h-4 w-4" />
            Fila de Envios
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <FollowupDashboard
            stats={dashboardStats}
            dailyMetrics={dailyMetrics}
            isLoading={isLoadingDailyMetrics}
            dateFrom={dashboardDateFrom}
            dateTo={dashboardDateTo}
            onDateFromChange={setDashboardDateFrom}
            onDateToChange={setDashboardDateTo}
          />
        </TabsContent>

        <TabsContent value="queue" className="mt-6 space-y-4">
          <FollowupFilters
            dateFrom={queueDateFrom}
            dateTo={queueDateTo}
            stateFilter={stateFilter}
            onDateFromChange={setQueueDateFrom}
            onDateToChange={setQueueDateTo}
            onStateFilterChange={setStateFilter}
          />
          <FollowupQueue
            items={filteredItems}
            stepCadence={stepCadence}
            isLoading={isLoadingQueue}
            onUpdateState={handleUpdateState}
            onRestart={handleRestart}
            onFinalize={handleFinalize}
            isUpdating={updateStateMutation.isPending || restartItemMutation.isPending || finalizeItemMutation.isPending}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <FollowupConfig
            config={config}
            isLoading={isLoadingConfig}
            isSaving={saveConfigMutation.isPending}
            onSave={handleSaveConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
