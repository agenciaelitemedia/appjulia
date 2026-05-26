import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Table2 } from 'lucide-react';
import { TelemetryDashboard } from './TelemetryDashboard';
import { TelemetryExplorer } from './TelemetryExplorer';

export function DeviceTelemetryTab() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
        <TabsTrigger value="data" className="gap-2"><Table2 className="h-4 w-4" /> Dados</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <TelemetryDashboard />
      </TabsContent>

      <TabsContent value="data">
        <TelemetryExplorer />
      </TabsContent>
    </Tabs>
  );
}
