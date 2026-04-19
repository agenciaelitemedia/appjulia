import { useState, useCallback, useEffect } from 'react';
import { Headset } from 'lucide-react';
import { useInactiveLeads } from './hooks/useInactiveLeads';
import { InactiveLeadsList } from './components/InactiveLeadsList';
import { WhatsAppMessagesDialog } from '@/pages/crm/components/WhatsAppMessagesDialog';
import { AgentMultiSelectPopover } from '@/components/agents/AgentMultiSelectPopover';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import { useCRMStages, useTeamForAgent } from '@/pages/crm/hooks/useCRMData';
import { saveAgentCodes } from '@/hooks/usePersistedPeriod';
import type { InactiveSession } from '@/lib/externalDb';

export default function HumanSupportPage() {
  const { data: agents = [], isLoading: isLoadingAgents } = useJuliaAgents();
  const { data: stages = [] } = useCRMStages();
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<InactiveSession | null>(null);
  const { data: teamMembers = [] } = useTeamForAgent(selectedAgents[0] ?? null);

  // Pre-select all agents on load
  useEffect(() => {
    if (agents.length > 0 && selectedAgents.length === 0) {
      setSelectedAgents(agents.map((a) => a.cod_agent));
    }
  }, [agents, selectedAgents.length]);

  const {
    leads,
    totalFiltered,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedPeriod,
    setSelectedPeriod,
    ownerFilter,
    setOwnerFilter,
    stageIds,
    setStageIds,
    juliaFilter,
    setJuliaFilter,
    hasMore,
    loadMore,
    refetch,
  } = useInactiveLeads(selectedAgents);

  const handleAgentsChange = useCallback((codes: string[]) => {
    setSelectedAgents(codes);
    saveAgentCodes(codes);
    setSelectedLead(null);
  }, []);

  const handleStartConversation = useCallback((whatsappNumber: string) => {
    const codAgent = selectedAgents[0] || '';
    const syntheticLead: InactiveSession = {
      id: Date.now(),
      whatsapp_number: whatsappNumber,
      active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cod_agent: codAgent,
      contact_name: null,
      business_name: null,
      card_id: null,
      stage_id: null,
      stage_name: null,
      stage_color: null,
      owner_name: null,
    };
    setSelectedLead(syntheticLead);
    setTimeout(() => refetch(), 1000);
  }, [selectedAgents, refetch]);

  const handleSelectLead = useCallback((lead: InactiveSession) => {
    setSelectedLead(lead);
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden -m-4 lg:-m-6">
      {/* Sidebar - Lead List */}
      <div className="w-96 min-w-[384px] shrink-0">
        <InactiveLeadsList
          leads={leads}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLeadId={selectedLead?.id ?? null}
          onSelectLead={handleSelectLead}
          totalCount={totalFiltered}
          hasMore={hasMore}
          onLoadMore={loadMore}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          teamMembers={teamMembers}
          codAgent={selectedAgents[0] ?? null}
          onStartConversation={handleStartConversation}
          stages={stages}
          stageIds={stageIds}
          onStageIdsChange={setStageIds}
          juliaFilter={juliaFilter}
          onJuliaFilterChange={setJuliaFilter}
          agentSelect={
            <AgentMultiSelectPopover
              agents={agents}
              value={selectedAgents}
              onChange={handleAgentsChange}
              disabled={isLoadingAgents}
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
