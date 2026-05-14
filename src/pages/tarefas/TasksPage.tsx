import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TasksDashboard } from './components/TasksDashboard';
import { TasksListTab } from './components/TasksListTab';
import { TasksConfigTab } from './components/TasksConfigTab';
import { LayoutDashboard, ListChecks, Settings } from 'lucide-react';

export default function TasksPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie suas tarefas, acompanhe seu desempenho e veja o ranking da equipe.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="dashboard" className="h-full flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-10 bg-transparent p-0 gap-1">
              <TabsTrigger
                value="dashboard"
                className="h-10 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="h-10 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <ListChecks className="h-4 w-4" /> Tarefas
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="config"
                  className="h-10 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
                >
                  <Settings className="h-4 w-4" /> Configurações
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="dashboard" className="m-0 mt-0">
              <TasksDashboard />
            </TabsContent>
            <TabsContent value="tasks" className="m-0 mt-0">
              <TasksListTab />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="config" className="m-0 mt-0">
                <TasksConfigTab />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
