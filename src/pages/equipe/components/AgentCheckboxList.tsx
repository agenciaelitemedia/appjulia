import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PrincipalUserAgent } from "../types";
import { Bot, Eye } from "lucide-react";

// Selected agent with cod_agent as key (agent_id can be null for monitored)
export interface SelectedAgent {
  agentId: number | null;
  codAgent: string;
}

interface AgentCheckboxListProps {
  agents: PrincipalUserAgent[];
  selectedAgents: SelectedAgent[];
  onChange: (agents: SelectedAgent[]) => void;
  isLoading?: boolean;
}

export function AgentCheckboxList({
  agents,
  selectedAgents,
  onChange,
  isLoading,
}: AgentCheckboxListProps) {
  // Use cod_agent as key since agent_id can be null
  const selectedCodAgents = selectedAgents.map((a) => a.codAgent);

  const handleToggle = (agent: PrincipalUserAgent) => {
    if (selectedCodAgents.includes(agent.cod_agent)) {
      onChange(selectedAgents.filter((a) => a.codAgent !== agent.cod_agent));
    } else {
      onChange([
        ...selectedAgents,
        { agentId: agent.agent_id, codAgent: agent.cod_agent },
      ]);
    }
  };

  const handleSelectAll = () => {
    if (selectedAgents.length === agents.length) {
      onChange([]);
    } else {
      onChange(
        agents.map((a) => ({ agentId: a.agent_id, codAgent: a.cod_agent }))
      );
    }
  };

  // Split agents by type
  const ownAgents = agents.filter((a) => a.agent_type === 'own');
  const monitoredAgents = agents.filter((a) => a.agent_type === 'monitored');

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum agente disponível</p>
      </div>
    );
  }

  const renderAgentItem = (agent: PrincipalUserAgent) => (
    <div
      key={agent.cod_agent}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <Checkbox
        id={`agent-${agent.cod_agent}`}
        checked={selectedCodAgents.includes(agent.cod_agent)}
        onCheckedChange={() => handleToggle(agent)}
      />
      <Label
        htmlFor={`agent-${agent.cod_agent}`}
        className="flex-1 cursor-pointer"
      >
        <span className="font-medium">{agent.business_name}</span>
        <span className="text-muted-foreground text-xs ml-2">
          #{agent.cod_agent}
        </span>
      </Label>
      {!agent.status && (
        <span className="text-xs text-destructive">Inativo</span>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Select All */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          id="select-all"
          checked={selectedAgents.length === agents.length && agents.length > 0}
          onCheckedChange={handleSelectAll}
        />
        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          Selecionar todos ({agents.length})
        </Label>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-4">
        {/* Own Agents Section */}
        {ownAgents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">
                Meus Agentes ({ownAgents.length})
              </h4>
            </div>
            <div className="space-y-1">
              {ownAgents.map(renderAgentItem)}
            </div>
          </div>
        )}

        {/* Monitored Agents Section */}
        {monitoredAgents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">
                Agentes Monitorados ({monitoredAgents.length})
              </h4>
            </div>
            <div className="space-y-1">
              {monitoredAgents.map(renderAgentItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
