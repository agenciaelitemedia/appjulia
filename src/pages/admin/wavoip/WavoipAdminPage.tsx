import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneCall, CreditCard, Users, ShoppingCart, Smartphone, History } from 'lucide-react';
import { WavoipClientsTab } from './components/WavoipClientsTab';
import { WavoipPlansTab } from './components/WavoipPlansTab';
import { WavoipOrdersTab } from './components/WavoipOrdersTab';
import { WavoipDevicesTab } from './components/WavoipDevicesTab';
import { WavoipHistoryTab } from './components/WavoipHistoryTab';

export default function WavoipAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PhoneCall className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Wavoip</h1>
          <p className="text-sm text-muted-foreground">
            Gerenciar planos, ativações, dispositivos e histórico de chamadas WhatsApp via Wavoip
          </p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clients" className="gap-1.5">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5">
            <Smartphone className="h-4 w-4" />
            Dispositivos
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients"><WavoipClientsTab /></TabsContent>
        <TabsContent value="plans"><WavoipPlansTab /></TabsContent>
        <TabsContent value="orders"><WavoipOrdersTab /></TabsContent>
        <TabsContent value="devices"><WavoipDevicesTab /></TabsContent>
        <TabsContent value="history"><WavoipHistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}