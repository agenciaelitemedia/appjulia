import { TrendingUp, Users, UserCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CampaignFunnelData } from '../types';

interface CampaignMiniFunnelProps {
  data: CampaignFunnelData;
}

const stages = [
  { 
    key: 'total_leads' as const, 
    label: 'Total', 
    colorClass: 'bg-primary',
    icon: Users,
    tooltip: 'Total de leads da campanha'
  },
  { 
    key: 'qualified' as const, 
    label: 'Qualificados', 
    colorClass: 'bg-chart-2',
    icon: TrendingUp,
    tooltip: 'Leads em Negociação, Contrato em Curso ou Contrato Assinado'
  },
  { 
    key: 'clients' as const, 
    label: 'Clientes', 
    colorClass: 'bg-chart-5',
    icon: UserCheck,
    tooltip: 'Leads com Contrato Assinado'
  },
];

export function CampaignMiniFunnel({ data }: CampaignMiniFunnelProps) {
  const total = data.total_leads || 1; // Avoid division by zero
  
  // Don't render if no leads
  if (data.total_leads === 0) return null;

  return (
    <TooltipProvider>
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Funil de Conversão
        </p>
        <div className="space-y-1.5">
          {stages.map((stage) => {
            const value = data[stage.key];
            const percentage = stage.key === 'total_leads' 
              ? 100 
              : ((value / total) * 100);
            const widthPercent = Math.max(8, (value / total) * 100); // Min 8% for visibility
            const Icon = stage.icon;

            return (
              <Tooltip key={stage.key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                      <div
                        className={`h-full ${stage.color} transition-all duration-300`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium min-w-[60px] text-right">
                      {value}
                      {stage.key !== 'total_leads' && (
                        <span className="text-muted-foreground ml-1">
                          ({percentage.toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{stage.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
