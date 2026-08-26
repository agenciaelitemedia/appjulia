import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, FileText, FlaskConical, Megaphone, Radio, ScrollText, SlidersHorizontal, UserX, Users } from 'lucide-react';
import { useAuth } from '../extend/auth';
import { useEnsureDisparosModule } from '../extend/useEnsureDisparosModule';
import { useDspClientId } from '../hooks/useDspClientId';
import { CampaignsTab } from '../components/CampaignsTab';
import { TemplatesTab } from '../components/TemplatesTab';
import { SimulationTab } from '../components/SimulationTab';
import { MonitorTab } from '../components/MonitorTab';
import { LogsTab } from '../components/LogsTab';
import { SuppressionTab } from '../components/SuppressionTab';
import { SettingsTab } from '../components/SettingsTab';
import { ChannelsTab } from '../components/ChannelsTab';
import { PublicoTab } from '../components/PublicoTab';

import { DISPAROS_MODULE } from '../module';

export default function DisparosPage() {
  useEnsureDisparosModule();
  const { hasPermission, isAdmin } = useAuth();
  const { clientId } = useDspClientId();
  const [tab, setTab] = useState('campanhas');

  const canEdit = isAdmin || hasPermission(DISPAROS_MODULE.code as any, 'edit');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
        <p className="text-muted-foreground">
          Campanhas de WhatsApp com limites, rotação de números e proteção anti-bloqueio
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="campanhas" className="gap-2"><Megaphone className="h-4 w-4" />Campanhas</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="publico" className="gap-2"><Users className="h-4 w-4" />Público</TabsTrigger>
          <TabsTrigger value="canais" className="gap-2"><Radio className="h-4 w-4" />Canais</TabsTrigger>
          <TabsTrigger value="simulacao" className="gap-2"><FlaskConical className="h-4 w-4" />Simulação</TabsTrigger>

          <TabsTrigger value="monitor" className="gap-2"><Activity className="h-4 w-4" />Monitoramento</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><ScrollText className="h-4 w-4" />Logs</TabsTrigger>
          <TabsTrigger value="supressao" className="gap-2"><UserX className="h-4 w-4" />Supressão</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><SlidersHorizontal className="h-4 w-4" />Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="campanhas" className="mt-6">
          <CampaignsTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="templates" className="mt-6">
          <TemplatesTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="publico" className="mt-6">
          <PublicoTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="canais" className="mt-6">
          <ChannelsTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="simulacao" className="mt-6">

          <SimulationTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="monitor" className="mt-6">
          <MonitorTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="supressao" className="mt-6">
          <SuppressionTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="config" className="mt-6">
          <SettingsTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
