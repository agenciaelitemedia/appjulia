import { useState, useEffect } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AgentSearchSelect } from '@/components/AgentSearchSelect';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import { useContractNotificationConfigs } from '@/hooks/useContractNotificationConfig';
import { getSavedAgentCodes, saveAgentCodes } from '@/hooks/usePersistedPeriod';
import { LeadFollowupTab } from './components/LeadFollowupTab';
import { OfficeNotificationTab } from './components/OfficeNotificationTab';
import { NotificationLogsTab } from './components/NotificationLogsTab';
import { NotificationQueueTab } from './components/NotificationQueueTab';
import { useQueryClient } from '@tanstack/react-query';

export default function ContractNotificationsPage() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();

  // Set default agent on load (restore saved or pick first)
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      const saved = getSavedAgentCodes();
      if (saved !== null && saved.length > 0) {
        const validSaved = saved.find(code => agents.some(a => a.cod_agent === code));
        setSelectedAgent(validSaved || agents[0].cod_agent);
      } else {
        setSelectedAgent(agents[0].cod_agent);
      }
    }
  }, [agents, selectedAgent]);

  // Persist selection
  useEffect(() => {
    if (selectedAgent) {
      saveAgentCodes([selectedAgent]);
    }
  }, [selectedAgent]);

  const { data: configs } = useContractNotificationConfigs(selectedAgent);

  const followupConfig = configs?.find((c) => c.type === 'LEAD_FOLLOWUP');
  const officeConfig = configs?.find((c) => c.type === 'OFFICE_ALERT');

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contract-notification-configs'] });
    queryClient.invalidateQueries({ queryKey: ['contract-notification-logs'] });
    queryClient.invalidateQueries({ queryKey: ['contract-notification-queue'] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notificações de Contrato</h1>
            <p className="text-muted-foreground text-sm">
              Configure alertas automáticos para contratos gerados e assinados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Agente:</Label>
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

      {selectedAgent && (
        <Tabs defaultValue="followup" className="w-full">
          <TabsList>
            <TabsTrigger value="followup">Followup de Leads</TabsTrigger>
            <TabsTrigger value="office">Notificar Escritório</TabsTrigger>
            <TabsTrigger value="queue">Fila</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="followup">
            <LeadFollowupTab codAgent={selectedAgent} config={followupConfig} />
          </TabsContent>

          <TabsContent value="office">
            <OfficeNotificationTab codAgent={selectedAgent} config={officeConfig} />
          </TabsContent>

          <TabsContent value="queue">
            <NotificationQueueTab codAgent={selectedAgent} />
          </TabsContent>

          <TabsContent value="logs">
            <NotificationLogsTab codAgent={selectedAgent} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
