import { Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InsightsMonitorTab } from './components/InsightsMonitorTab';
import { CopilotSettingsTab } from './components/CopilotSettingsTab';
import { useCopilotAdmin } from './hooks/useCopilotAdmin';

export default function CopilotAdminPage() {
  const {
    insights, totalInsights, isLoadingInsights,
    filters, setFilters, page, setPage, pageSize,
    settings, isLoadingSettings, saveSettings,
    agents,
  } = useCopilotAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Copiloto Julia IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitoramento de insights e configurações do copiloto
        </p>
      </div>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights ({totalInsights})</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          <InsightsMonitorTab
            insights={insights}
            totalInsights={totalInsights}
            isLoading={isLoadingInsights}
            filters={filters}
            setFilters={setFilters}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            agents={agents}
          />
        </TabsContent>

        <TabsContent value="settings">
          <CopilotSettingsTab
            settings={settings}
            isLoading={isLoadingSettings}
            onSave={(s) => saveSettings.mutate(s)}
            isSaving={saveSettings.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
