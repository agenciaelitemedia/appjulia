import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Video } from 'lucide-react';
import { VideoPlansTab } from './components/VideoPlansTab';
import { VideoOrdersTab } from './components/VideoOrdersTab';

export default function VideoAdminPage() {
  const [tab, setTab] = useState('plans');
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Video className="h-6 w-6" /> Videochamadas — Administração
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie planos e pedidos de contratação de videochamadas.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4"><VideoPlansTab /></TabsContent>
        <TabsContent value="orders" className="mt-4"><VideoOrdersTab /></TabsContent>
      </Tabs>
    </div>
  );
}