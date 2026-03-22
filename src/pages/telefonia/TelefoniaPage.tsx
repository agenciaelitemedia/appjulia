import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, PhoneCall, History, BarChart3 } from 'lucide-react';
import { MeusRamaisTab } from './components/MeusRamaisTab';
import { DiscadorTab } from './components/DiscadorTab';
import { HistoricoTab } from './components/HistoricoTab';
import { RelatoriosTab } from './components/RelatoriosTab';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';

export default function TelefoniaPage() {
  const { data: agentsData } = useMyAgents();
  const allAgents = [...(agentsData?.myAgents || []), ...(agentsData?.monitoredAgents || [])];
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const codAgent = selectedAgent || (allAgents.length > 0 ? String(allAgents[0]?.cod_agent || '') : '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Phone className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Telefonia</h1>
            <p className="text-sm text-muted-foreground">Gerencie ramais, faça ligações e acompanhe seu uso</p>
          </div>
        </div>

        {allAgents.length > 1 && (
          <Select value={codAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione o agente..." />
            </SelectTrigger>
            <SelectContent>
              {allAgents.map((a) => (
                <SelectItem key={a.cod_agent} value={String(a.cod_agent)}>
                  Agente {a.cod_agent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!codAgent ? (
        <p className="text-sm text-muted-foreground">Nenhum agente vinculado. Solicite acesso ao administrador.</p>
      ) : (
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

          <TabsContent value="extensions"><MeusRamaisTab codAgent={codAgent} /></TabsContent>
          <TabsContent value="dialer"><DiscadorTab codAgent={codAgent} /></TabsContent>
          <TabsContent value="history"><HistoricoTab codAgent={codAgent} /></TabsContent>
          <TabsContent value="reports"><RelatoriosTab codAgent={codAgent} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
