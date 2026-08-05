import { KanbanSquare, LayoutDashboard, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOfficeClientId } from '../hooks/useOfficeClientId';
import { useOfficeByClient } from '../hooks/useOffices';
import { OfficeAtendimentosTab } from '../components/OfficeAtendimentosTab';
import { OfficeEquipeTab } from '../components/OfficeEquipeTab';
import { OfficeCrmTab } from '../components/OfficeCrmTab';

export default function OfficeDashboardPage() {
  const { data: clientId } = useOfficeClientId();
  const { data: office } = useOfficeByClient(clientId ? Number(clientId) : null);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutDashboard className="h-6 w-6 text-primary" /> Painel de Atendimento
        </h1>
        <p className="text-sm text-muted-foreground">
          {office?.office_name ? `${office.office_name} · ` : ''}Indicadores de chat, equipe e CRM
        </p>
      </div>

      <Tabs defaultValue="atendimentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="atendimentos" className="gap-2">
            <LayoutDashboard className="h-4 w-4" /> Atendimentos
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-2">
            <Users className="h-4 w-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="crms" className="gap-2">
            <KanbanSquare className="h-4 w-4" /> CRM's
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atendimentos">
          <OfficeAtendimentosTab />
        </TabsContent>
        <TabsContent value="equipe">
          <OfficeEquipeTab />
        </TabsContent>
        <TabsContent value="crms">
          <OfficeCrmTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}