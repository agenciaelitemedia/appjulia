import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneCall, History, BarChart3 } from 'lucide-react';
import { MeusRamaisTab } from './components/MeusRamaisTab';
import { DiscadorTab } from './components/DiscadorTab';
import { HistoricoTab } from './components/HistoricoTab';
import { RelatoriosTab } from './components/RelatoriosTab';

export default function TelefoniaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Telefonia</h1>
          <p className="text-sm text-muted-foreground">Gerencie ramais, faça ligações e acompanhe seu uso</p>
        </div>
      </div>

      <Tabs defaultValue="extensions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="extensions" className="gap-1.5">
            <Phone className="h-4 w-4" />
            Meus Ramais
          </TabsTrigger>
          <TabsTrigger value="dialer" className="gap-1.5">
            <PhoneCall className="h-4 w-4" />
            Discador
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extensions"><MeusRamaisTab /></TabsContent>
        <TabsContent value="dialer"><DiscadorTab /></TabsContent>
        <TabsContent value="history"><HistoricoTab /></TabsContent>
        <TabsContent value="reports"><RelatoriosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
