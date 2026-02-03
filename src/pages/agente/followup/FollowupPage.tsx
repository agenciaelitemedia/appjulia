import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { LayoutDashboard, List, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentSearchSelect } from '@/components/AgentSearchSelect';

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
import { UnifiedFilters } from '@/components/filters/UnifiedFilters';
import { UnifiedFiltersState } from '@/components/filters/types';
import { getInitialDates } from '@/hooks/usePersistedPeriod';

// Queue states for the filter
const QUEUE_STATES = [
  { value: 'all', label: 'Todos Estados' },
  { value: 'SEND', label: 'Em FollowUp' },
  { value: 'STOP', label: 'Parados' },
];

/**
 * Parse JSONB fields from database with multi-parse support.
 * Handles double-encoded strings (e.g., "\"{...}\"") by parsing recursively.
 * This prevents corrupted data from causing issues in the UI.
 */
function parseJsonField<T extends Record<string, unknown>>(
  value: unknown,
  defaultValue: T
): T {
  if (value === null || value === undefined) return defaultValue;
  
  // Already an object (and not array)
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  
  // String - try to parse recursively (handles single and double-encoded)
  if (typeof value === 'string') {
    let parsed: unknown = value;
    for (let i = 0; i < 3; i++) {
      if (typeof parsed !== 'string') break;
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return defaultValue;
      }
    }
    if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
      return parsed as T;
    }
  }
  
  return defaultValue;
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
  
  const initialDates = getInitialDates();
  
  // Dashboard filters (using UnifiedFilters)
  const [dashboardFilters, setDashboardFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
    stateFilter: 'all',
  });
  
  // Queue filters (using UnifiedFilters)
  const [queueFilters, setQueueFilters] = useState<UnifiedFiltersState>({
    search: '',
    agentCodes: [],
    dateFrom: initialDates.dateFrom,
    dateTo: initialDates.dateTo,
    stateFilter: 'all',
  });

  // Fetch agents
  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();

  // Set default agent - always select first available agent on load
  // Uses agents from user_agents table (single source of truth)
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].cod_agent);
    }
  }, [agents, selectedAgent]);

  // Update agentCodes when selectedAgent changes
  useEffect(() => {
    if (selectedAgent) {
      setDashboardFilters(prev => ({ ...prev, agentCodes: [selectedAgent] }));
      setQueueFilters(prev => ({ ...prev, agentCodes: [selectedAgent] }));
    }
  }, [selectedAgent]);

  // Filters for data hooks
  const dashboardHookFilters: FollowupFiltersState = useMemo(() => ({
    agentCodes: selectedAgent ? [selectedAgent] : [],
    dateFrom: dashboardFilters.dateFrom,
    dateTo: dashboardFilters.dateTo,
  }), [selectedAgent, dashboardFilters.dateFrom, dashboardFilters.dateTo]);

  const queueHookFilters: FollowupFiltersState = useMemo(() => ({
    agentCodes: selectedAgent ? [selectedAgent] : [],
    dateFrom: queueFilters.dateFrom,
    dateTo: queueFilters.dateTo,
    state: queueFilters.stateFilter,
  }), [selectedAgent, queueFilters.dateFrom, queueFilters.dateTo, queueFilters.stateFilter]);

  // Fetch data
  const { data: configData, isLoading: isLoadingConfig, refetch: refetchConfig } = useFollowupConfig(selectedAgent);
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useFollowupQueue(queueHookFilters);
  const { data: totalSentCount = 0, refetch: refetchSentCount } = useFollowupSentCount(queueHookFilters);
  
  // Dashboard-specific data
  const { data: dailyMetrics = [], isLoading: isLoadingDailyMetrics, refetch: refetchDailyMetrics } = useFollowupDailyMetrics(dashboardHookFilters);
  const { data: returnData, refetch: refetchReturnRate } = useFollowupReturnRate(dashboardHookFilters);
  
  // Previous period stats for comparison
  const { previous: previousStats, isLoading: isLoadingPrevious } = useFollowupPreviousPeriodStats(dashboardHookFilters);

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
    if (!queueFilters.search.trim()) return enrichedQueueItems;
    
    const search = queueFilters.search.toLowerCase();
    return enrichedQueueItems.filter((item) =>
      item.name_client?.toLowerCase().includes(search) ||
      item.session_id?.toLowerCase().includes(search)
    );
  }, [enrichedQueueItems, queueFilters.search]);

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

  // Dashboard stats
  const dashboardStats: FollowupStats = useMemo(() => {
    return {
      total: returnData?.totalLeads || 0,
      totalSent: dailyMetrics.reduce((sum, d) => sum + d.messagesSent, 0),
      waiting: returnData?.leadsInFollowup || 0,
      stopped: returnData?.responses || 0,
      followupRate: returnData?.followupRate || 0,
      responseRate: returnData?.returnRate || 0,
      interventionRate: returnData?.interventionRate || 0,
      lossRate: returnData?.lossRate || 0,
      previous: isLoadingPrevious ? undefined : previousStats,
    };
  }, [dailyMetrics, returnData, previousStats, isLoadingPrevious]);

  // Queue page stats
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
      interventionRate: 0,
      lossRate: 0,
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
  };

  // Get current filters based on active tab
  const currentFilters = activeTab === 'dashboard' ? dashboardFilters : queueFilters;
  const setCurrentFilters = activeTab === 'dashboard' ? setDashboardFilters : setQueueFilters;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FollowUp</h1>
          <p className="text-muted-foreground">
            Configure as cadências de reengajamento e monitore a fila de envios
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Agent Selector with Search */}
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">
              Agente:
            </Label>
            <AgentSearchSelect
              agents={agents}
              value={selectedAgent}
              onValueChange={setSelectedAgent}
              disabled={isLoadingAgents}
              placeholder="Selecione um agente"
            />
          </div>

          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters - positioned right after header, hidden on config tab */}
      {activeTab !== 'config' && (
        <UnifiedFilters
          agents={[]} // Don't show agent selector - using dedicated selector above
          filters={currentFilters}
          onFiltersChange={setCurrentFilters}
          showAgentSelector={false}
          showQuickPeriods
          showStateFilter={activeTab === 'queue'}
          stateOptions={QUEUE_STATES}
          periodTooltip="Filtra pela data da última atividade do lead"
        />
      )}

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
            dateFrom={dashboardFilters.dateFrom}
            dateTo={dashboardFilters.dateTo}
          />
        </TabsContent>

        <TabsContent value="queue" className="mt-6 space-y-4">
          <FollowupQueue
            items={filteredItems}
            stepCadence={stepCadence}
            isLoading={isLoadingQueue}
            onUpdateState={handleUpdateState}
            onRestart={handleRestart}
            onFinalize={handleFinalize}
            isUpdating={updateStateMutation.isPending || restartItemMutation.isPending || finalizeItemMutation.isPending}
            searchTerm={queueFilters.search}
            onSearchChange={(search) => setQueueFilters(prev => ({ ...prev, search }))}
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
