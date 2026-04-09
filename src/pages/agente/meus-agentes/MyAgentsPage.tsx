import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyAgents } from './hooks/useMyAgents';
import { AgentCard } from './components/AgentCard';

export default function MyAgentsPage() {
  const { data, isLoading, error } = useMyAgents();
  const [activeTab, setActiveTab] = useState('my');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Erro ao carregar agentes: {error.message}
      </div>
    );
  }

  const { myAgents = [], monitoredAgents = [] } = data || {};
  const hasMonitored = monitoredAgents.length > 0;

  const agentGrid = (agents: typeof myAgents, isMonitored = false) =>
    agents.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
        {isMonitored ? 'Nenhum agente monitorado' : 'Nenhum agente vinculado à sua conta'}
      </div>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={`${isMonitored ? 'mon' : 'my'}-${agent.cod_agent}`}
            agent={agent}
            isMonitored={isMonitored}
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Agentes</h1>
        <p className="text-muted-foreground">
          Gerencie os agentes vinculados à sua conta
        </p>
      </div>

      {hasMonitored ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my">
              Meus Agentes ({myAgents.length})
            </TabsTrigger>
            <TabsTrigger value="monitored">
              Agentes Monitorados ({monitoredAgents.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my" className="mt-4">
            {agentGrid(myAgents)}
          </TabsContent>
          <TabsContent value="monitored" className="mt-4">
            {agentGrid(monitoredAgents, true)}
          </TabsContent>
        </Tabs>
      ) : (
        agentGrid(myAgents)
      )}
    </div>
  );
}
