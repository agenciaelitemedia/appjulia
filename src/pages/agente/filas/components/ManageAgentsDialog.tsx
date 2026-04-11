import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X, Star } from 'lucide-react';
import { Queue, useQueueMutations } from '../hooks/useQueues';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';

interface ManageAgentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: Queue;
}

export function ManageAgentsDialog({ open, onOpenChange, queue }: ManageAgentsDialogProps) {
  const { linkAgent, unlinkAgent } = useQueueMutations();
  const { data: agentData } = useMyAgents();
  const [selectedAgent, setSelectedAgent] = useState('');

  const linkedAgents = queue.queue_agent_links || [];
  const allAgents = agentData?.myAgents || [];
  const linkedCodes = new Set(linkedAgents.map((l) => l.cod_agent));
  const availableAgents = allAgents.filter((a) => !linkedCodes.has(a.cod_agent));

  const handleLink = () => {
    if (!selectedAgent) return;
    linkAgent.mutate(
      { queue_id: queue.id, cod_agent: selectedAgent, is_primary: linkedAgents.length === 0 },
      { onSuccess: () => setSelectedAgent('') }
    );
  };

  const handleUnlink = (codAgent: string) => {
    unlinkAgent.mutate({ queue_id: queue.id, cod_agent: codAgent });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agentes da Fila: {queue.name}</DialogTitle>
          <DialogDescription>Vincule ou desvincule agentes de IA a esta fila de atendimento.</DialogDescription>
        </DialogHeader>

        {/* Linked agents */}
        <div className="space-y-2">
          {linkedAgents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              Nenhum agente vinculado. Esta fila funcionará sem IA.
            </p>
          )}
          {linkedAgents.map((link) => {
            const agent = allAgents.find((a) => a.cod_agent === link.cod_agent);
            return (
              <div key={link.cod_agent} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">#{link.cod_agent}</span>
                  {agent && (
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {agent.business_name || agent.client_name}
                    </span>
                  )}
                  {link.is_primary && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Star className="w-3 h-3" /> Principal
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleUnlink(link.cod_agent)}
                  disabled={unlinkAgent.isPending}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add agent */}
        {availableAgents.length > 0 && (
          <div className="flex gap-2 mt-2">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecionar agente..." />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a.cod_agent} value={a.cod_agent}>
                    #{a.cod_agent} - {a.business_name || a.client_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLink} disabled={!selectedAgent || linkAgent.isPending} size="icon">
              {linkAgent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
