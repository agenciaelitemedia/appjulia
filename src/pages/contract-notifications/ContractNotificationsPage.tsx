import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useContractNotificationConfigs } from '@/hooks/useContractNotificationConfig';
import { LeadFollowupTab } from './components/LeadFollowupTab';
import { OfficeNotificationTab } from './components/OfficeNotificationTab';

export default function ContractNotificationsPage() {
  const { user } = useAuth();
  const codAgent = user?.cod_agent ? String(user.cod_agent) : null;
  const { data: configs } = useContractNotificationConfigs(codAgent);

  const followupConfig = configs?.find((c) => c.type === 'LEAD_FOLLOWUP');
  const officeConfig = configs?.find((c) => c.type === 'OFFICE_ALERT');

  if (!codAgent) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhum agente selecionado.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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

      <Tabs defaultValue="followup" className="w-full">
        <TabsList>
          <TabsTrigger value="followup">Followup de Leads</TabsTrigger>
          <TabsTrigger value="office">Notificar Escritório</TabsTrigger>
        </TabsList>

        <TabsContent value="followup">
          <LeadFollowupTab codAgent={codAgent} config={followupConfig} />
        </TabsContent>

        <TabsContent value="office">
          <OfficeNotificationTab codAgent={codAgent} config={officeConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
