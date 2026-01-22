import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { CRMAgentWorkload } from '../../types';

interface AgentWorkloadChartProps {
  data: CRMAgentWorkload[];
  isLoading?: boolean;
}

const MAX_CAPACITY = 60; // Assumed max capacity per agent

function getWorkloadStatus(active: number, stuck: number) {
  const percentage = (active / MAX_CAPACITY) * 100;
  
  if (percentage >= 90) return { status: 'critical', color: 'destructive', label: 'Crítico' };
  if (percentage >= 75) return { status: 'warning', color: 'default', label: 'Alto' };
  if (percentage >= 50) return { status: 'normal', color: 'secondary', label: 'Normal' };
  return { status: 'low', color: 'outline', label: 'Baixo' };
}

export function AgentWorkloadChart({ data, isLoading }: AgentWorkloadChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhum dado de carga disponível.
        </CardContent>
      </Card>
    );
  }

  const maxActive = Math.max(...data.map(d => d.active_leads), MAX_CAPACITY);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {data.map((agent) => {
            const workloadStatus = getWorkloadStatus(agent.active_leads, agent.stuck_leads);
            const percentage = Math.min((agent.active_leads / maxActive) * 100, 100);
            
            return (
              <div key={agent.cod_agent} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">
                      {agent.owner_name}
                    </span>
                    <Badge variant={workloadStatus.color as any} className="text-xs">
                      {workloadStatus.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {agent.active_leads} ativos
                    </span>
                    {agent.stuck_leads > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {agent.stuck_leads} parados
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={percentage} 
                    className="h-2 flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {Math.round(percentage)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-chart-2" />
              <span className="text-muted-foreground">Total ativos:</span>
              <span className="font-medium">
                {data.reduce((sum, a) => sum + a.active_leads, 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">Total parados:</span>
              <span className="font-medium text-destructive">
                {data.reduce((sum, a) => sum + a.stuck_leads, 0)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
