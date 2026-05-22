import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Send, ListChecks } from 'lucide-react';
import { CreateNotificationTab } from './components/CreateNotificationTab';
import { NotificationsListTab } from './components/NotificationsListTab';

export default function NotifyCustomersPage() {
  const [tab, setTab] = useState('create');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notificar Clientes
        </h1>
        <p className="text-muted-foreground">
          Envie mensagens, enquetes ou perguntas em tempo real para os usuários do sistema.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="create" className="gap-2"><Send className="w-4 h-4" /> Criar</TabsTrigger>
          <TabsTrigger value="manage" className="gap-2"><ListChecks className="w-4 h-4" /> Acompanhar</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <CreateNotificationTab onCreated={() => setTab('manage')} />
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <NotificationsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
