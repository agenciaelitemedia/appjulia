import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Bot, Eye } from 'lucide-react';
import { UserAgent } from '../types';

interface AgentCardProps {
  agent: UserAgent;
  isMonitored?: boolean;
}

export function AgentCard({ agent, isMonitored = false }: AgentCardProps) {
  const leadsPercentage = agent.plan_limit 
    ? Math.min((agent.leads_received / agent.plan_limit) * 100, 100)
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
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
          <span className="text-xs text-muted-foreground font-mono">
            #{agent.cod_agent}
          </span>
        </div>

        <h3 className="font-semibold text-foreground mb-1 truncate">
          {agent.business_name || agent.client_name || 'Sem nome'}
        </h3>

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
      </CardContent>
    </Card>
  );
}
