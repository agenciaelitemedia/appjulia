import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Bot, Eye, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserAgent } from '../types';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { ConnectionControlButtons } from './ConnectionControlButtons';

interface AgentCardProps {
  agent: UserAgent;
  isMonitored?: boolean;
}

export function AgentCard({ agent, isMonitored = false }: AgentCardProps) {
  const navigate = useNavigate();
  const { data: connectionStatus = 'no_config', isLoading } = useConnectionStatus(
    agent.hub,
    agent.evo_url,
    agent.evo_apikey,
    agent.evo_instancia,
    agent.waba_configured,
    agent.agent_id_from_agents
  );

  const leadsPercentage = agent.plan_limit 
    ? Math.min((agent.leads_received / agent.plan_limit) * 100, 100)
    : 0;

  const canEdit = !isMonitored && (agent.can_edit_config || agent.can_edit_prompt);

  const providerLabel = agent.hub === 'waba' ? 'API Oficial' : agent.hub === 'uazapi' ? 'UaZapi' : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header com badges */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isMonitored ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Bot className="w-4 h-4 text-primary" />
            )}
            <Badge variant={agent.status ? "default" : "secondary"}>
              {agent.status ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <ConnectionStatusBadge status={connectionStatus} isLoading={isLoading} />
        </div>

        {/* Nome */}
        <h3 className="font-semibold text-foreground mb-1 truncate">
          {agent.business_name || agent.client_name || 'Sem nome'}
        </h3>
        
        {/* Código do agente */}
        <p className="text-xs text-muted-foreground font-mono mb-1">
          #{agent.cod_agent}
        </p>

        {/* Provider info */}
        {providerLabel && (
          <p className="text-xs text-muted-foreground mb-1">
            Provider: {providerLabel}
          </p>
        )}

        {/* Instância WhatsApp (se UaZapi configurada) */}
        {agent.hub === 'uazapi' && agent.evo_instancia && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Instância: {agent.evo_instancia}
          </p>
        )}

        {/* WABA Number ID (se WABA configurada) */}
        {agent.hub === 'waba' && agent.waba_number_id && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Phone ID: {agent.waba_number_id}
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-3">
          Plano: {agent.plan_name || 'Não definido'}
        </p>

        {agent.plan_limit && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Leads do mês</span>
              <span className="font-medium">
                {agent.leads_received}/{agent.plan_limit}
              </span>
            </div>
            <Progress value={leadsPercentage} className="h-2" />
          </div>
        )}

        {/* Botões de controle */}
        {!isMonitored && (
          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
            <ConnectionControlButtons
              agent={agent}
              status={connectionStatus}
              isLoading={isLoading}
            />
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/agente/meus-agentes/${agent.cod_agent}/editar`)}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
