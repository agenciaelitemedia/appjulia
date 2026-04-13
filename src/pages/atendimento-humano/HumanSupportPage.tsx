import { useState, useCallback } from 'react';
import { Headset } from 'lucide-react';
import { useInactiveLeads } from './hooks/useInactiveLeads';
import { InactiveLeadsList } from './components/InactiveLeadsList';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { AgentSearchSelect } from '@/components/AgentSearchSelect';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import { getSavedAgentCodes, saveAgentCodes } from '@/hooks/usePersistedPeriod';
import type { InactiveSession } from '@/lib/externalDb';
import { useEffect } from 'react';

export default function HumanSupportPage() {
  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Restore saved agent on load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      const saved = getSavedAgentCodes();
      const first = saved?.[0];
      if (first && agents.some(a => a.cod_agent === first)) {
        setSelectedAgent(first);
      } else {
        setSelectedAgent(agents[0].cod_agent);
      }
    }
  }, [agents, selectedAgent]);

  const handleAgentChange = useCallback((code: string) => {
    setSelectedAgent(code);
    saveAgentCodes([code]);
    setSelectedLead(null);
  }, []);

  const {
    leads,
    allLeads,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedPeriod,
    setSelectedPeriod,
  } = useInactiveLeads(selectedAgent || undefined);

  const [selectedLead, setSelectedLead] = useState<InactiveSession | null>(null);

  const handleSelectLead = useCallback((lead: InactiveSession) => {
    setSelectedLead(lead);
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar - Lead List */}
      <div className="w-80 min-w-[320px] shrink-0">
        <InactiveLeadsList
          leads={leads}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLeadId={selectedLead?.id ?? null}
          onSelectLead={handleSelectLead}
          totalCount={allLeads.length}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          agentSelect={
            <AgentSearchSelect
              agents={agents}
              value={selectedAgent}
              onValueChange={handleAgentChange}
              disabled={isLoadingAgents}
              placeholder="Selecione um agente"
              className="w-full"
            />
          }
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-w-0">
        {selectedLead ? (
          <WhatsAppMessagesDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setSelectedLead(null);
            }}
            whatsappNumber={selectedLead.whatsapp_number}
            leadName={selectedLead.contact_name || undefined}
            codAgent={selectedLead.cod_agent}
            variant="inline"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 bg-muted/20">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Headset className="h-10 w-10 text-primary/60" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground/80">
                Selecione um lead para atender
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Leads com a Júlia IA inativa aparecem na lista à esquerda. 
                Clique em um lead para iniciar o atendimento humano.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
