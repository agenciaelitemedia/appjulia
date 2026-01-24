import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/contexts/AuthContext';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import {
  useFollowupConfig,
  useSaveFollowupConfig,
  useFollowupQueue,
  useFollowupQueueStats,
  useUpdateQueueState,
  useDeleteQueueItem,
} from '../hooks/useFollowupData';
import { FollowupFiltersState, FollowupConfig as FollowupConfigType } from '../types';

import { FollowupSummary } from './components/FollowupSummary';
import { FollowupConfig } from './components/FollowupConfig';
import { FollowupQueue } from './components/FollowupQueue';
import { FollowupFilters } from './components/FollowupFilters';
import { getTodayInSaoPaulo } from '@/lib/dateUtils';

export default function FollowupPage() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('queue');
  const [dateFrom, setDateFrom] = useState<string>(getTodayInSaoPaulo());
  const [dateTo, setDateTo] = useState<string>(getTodayInSaoPaulo());
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Fetch agents
  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();

  // Set default agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      // If user is not admin, select their agent
      if (user?.role !== 'admin' && user?.cod_agent) {
        setSelectedAgent(String(user.cod_agent));
      } else {
        setSelectedAgent(agents[0].cod_agent);
      }
    }
  }, [agents, selectedAgent, user]);

  // Filters for queue
  const filters: FollowupFiltersState = useMemo(() => ({
    agentCodes: selectedAgent ? [selectedAgent] : [],
    dateFrom,
    dateTo,
    state: stateFilter,
  }), [selectedAgent, dateFrom, dateTo, stateFilter]);

  // Fetch data
  const { data: configData, isLoading: isLoadingConfig, refetch: refetchConfig } = useFollowupConfig(selectedAgent);
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useFollowupQueue(filters);
  const { data: stats = { total: 0, queue: 0, send: 0, stop: 0 }, isLoading: isLoadingStats, refetch: refetchStats } = useFollowupQueueStats(selectedAgent ? [selectedAgent] : []);

  // Normalize data (handle array vs single object)
  const config: FollowupConfigType | null = useMemo(() => {
    if (!configData) return null;
    if (Array.isArray(configData)) return configData[0] || null;
    return configData;
  }, [configData]);

  const queueItems = useMemo(() => {
    if (!queueData) return [];
    // Always flatten and ensure we have a proper array
    const flattened = Array.isArray(queueData) ? queueData.flat() : [];
    return flattened as import('../types').FollowupQueueItem[];
  }, [queueData]);

  // Mutations
  const saveConfigMutation = useSaveFollowupConfig();
  const updateStateMutation = useUpdateQueueState();
  const deleteItemMutation = useDeleteQueueItem();

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

  const handleDeleteItem = (id: number) => {
    deleteItemMutation.mutate(id);
  };

  const handleRefresh = () => {
    refetchConfig();
    refetchQueue();
    refetchStats();
  };

  const selectedAgentName = agents.find((a) => a.cod_agent === selectedAgent)?.owner_name || 'Agente';

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

      {/* Summary Cards */}
      <FollowupSummary stats={stats} isLoading={isLoadingStats} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue" className="gap-2">
            <List className="h-4 w-4" />
            Fila de Envios
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-6 space-y-4">
          <FollowupFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            stateFilter={stateFilter}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onStateFilterChange={setStateFilter}
          />
          <FollowupQueue
            items={queueItems}
            isLoading={isLoadingQueue}
            onUpdateState={handleUpdateState}
            onDelete={handleDeleteItem}
            isUpdating={updateStateMutation.isPending || deleteItemMutation.isPending}
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
