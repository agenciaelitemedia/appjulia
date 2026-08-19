import { useEffect, useState } from 'react';
import { BellRing, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { AgentSearchSelect, useJuliaAgents, getSavedAgentCodes, saveAgentCodes } from '../extend/agents';
import { useAuth } from '../extend/auth';
import { GeralTab } from '../components/GeralTab';
import { ConfigurarAlertasTab } from '../components/ConfigurarAlertasTab';
import { HistoricoTab } from '../components/HistoricoTab';
import { CrmNotificacoesTab } from '../components/CrmNotificacoesTab';

export default function NotificacoesAlertasPage() {
  const { data: agents = [], isLoading } = useJuliaAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      const saved = getSavedAgentCodes();
      const validSaved = saved?.find((code) => agents.some((a) => a.cod_agent === code));
      setSelectedAgent(validSaved || agents[0].cod_agent);
    }
  }, [agents, selectedAgent]);

  useEffect(() => {
    if (selectedAgent) saveAgentCodes([selectedAgent]);
  }, [selectedAgent]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BellRing className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notificações e Alertas</h1>
            <p className="text-sm text-muted-foreground">
              Configure quem recebe no WhatsApp cada situação do atendimento e a mensagem enviada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Agente:</Label>
          <AgentSearchSelect
            agents={agents}
            value={selectedAgent}
            onValueChange={setSelectedAgent}
            disabled={isLoading}
            placeholder="Selecione um agente"
          />
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            title="Abrir CRM de Notificações em nova janela"
            onClick={() =>
              window.open('/crm-notificacoes', '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="alertas" className="w-full">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="alertas">Configurar Alertas</TabsTrigger>
          <TabsTrigger value="crm">CRM de Notificações</TabsTrigger>
          {isAdmin && <TabsTrigger value="historico">Histórico</TabsTrigger>}
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <GeralTab />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          {selectedAgent ? (
            <ConfigurarAlertasTab codAgent={selectedAgent} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um agente para configurar.</p>
          )}
        </TabsContent>

        <TabsContent value="crm" className="mt-6">
          <CrmNotificacoesTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="historico" className="mt-6">
            <HistoricoTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
