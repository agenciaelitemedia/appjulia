import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, History, Activity, Wrench } from 'lucide-react';
import { AIModelsConfig } from './components/AIModelsConfig';
import { UazapiHistoryTab } from './components/UazapiHistoryTab';
import { UazapiMonitorTab } from './components/UazapiMonitorTab';
import { QueueMaintenanceTab } from './components/QueueMaintenanceTab';

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações globais do sistema</p>
      </div>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="w-4 h-4" />
            IA's
          </TabsTrigger>
          <TabsTrigger value="uazapi-history" className="gap-2">
            <History className="w-4 h-4" />
            History UaZapi
          </TabsTrigger>
          <TabsTrigger value="uazapi-monitor" className="gap-2">
            <Activity className="w-4 h-4" />
            Monitor da Fila
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="w-4 h-4" />
            Manutenção de Filas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Modelos de IA</h2>
            <p className="text-sm text-muted-foreground">
              Configure qual modelo de IA será utilizado em cada funcionalidade
            </p>
          </div>
          <AIModelsConfig />
        </TabsContent>

        <TabsContent value="uazapi-history" className="mt-6">
          <UazapiHistoryTab />
        </TabsContent>

        <TabsContent value="uazapi-monitor" className="mt-6">
          <UazapiMonitorTab />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <QueueMaintenanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
