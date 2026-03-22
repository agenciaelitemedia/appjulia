import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, CreditCard, Users, Settings, History } from 'lucide-react';
import { PlansTab } from './components/PlansTab';
import { UserPlansTab } from './components/UserPlansTab';
import { ConfigTab } from './components/ConfigTab';
import { CallHistoryTab } from './components/CallHistoryTab';

export default function TelefoniaAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Telefonia</h1>
          <p className="text-sm text-muted-foreground">Gerenciar planos, ramais e configurações Api4Com</p>
        </div>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="plans" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="user-plans" className="gap-1.5">
            <Users className="h-4 w-4" />
            Vincular
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="user-plans"><UserPlansTab /></TabsContent>
        <TabsContent value="config"><ConfigTab /></TabsContent>
        <TabsContent value="history"><CallHistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
