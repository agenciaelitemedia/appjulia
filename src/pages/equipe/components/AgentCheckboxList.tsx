import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PrincipalUserAgent } from "../types";
import { Bot } from "lucide-react";

interface AgentCheckboxListProps {
  agents: PrincipalUserAgent[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  isLoading?: boolean;
}

export function AgentCheckboxList({
  agents,
  selectedIds,
  onChange,
  isLoading,
}: AgentCheckboxListProps) {
  const handleToggle = (agentId: number) => {
    if (selectedIds.includes(agentId)) {
      onChange(selectedIds.filter((id) => id !== agentId));
    } else {
      onChange([...selectedIds, agentId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === agents.length) {
      onChange([]);
    } else {
      onChange(agents.map((a) => a.agent_id));
    }
  };

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          id="select-all"
          checked={selectedIds.length === agents.length && agents.length > 0}
          onCheckedChange={handleSelectAll}
        />
        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          Selecionar todos ({agents.length})
        </Label>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.agent_id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              id={`agent-${agent.agent_id}`}
              checked={selectedIds.includes(agent.agent_id)}
              onCheckedChange={() => handleToggle(agent.agent_id)}
            />
            <Label
              htmlFor={`agent-${agent.agent_id}`}
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
        ))}
      </div>
    </div>
  );
}
