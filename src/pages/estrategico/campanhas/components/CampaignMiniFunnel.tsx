import { Users, Bot, ClipboardCheck, Star, Trophy } from 'lucide-react';
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

const FUNNEL_STAGES = [
  {
    key: 'total_leads',
    label: 'Entrada',
    color: '#3b82f6', // blue
    icon: Users,
    description: 'Total de leads captados pela campanha',
  },
  {
    key: 'atendidos',
    label: 'Atendidos JulIA',
    color: '#22c55e', // green
    icon: Bot,
    description: 'Leads que foram atendidos pela JulIA',
  },
  {
    key: 'em_qualificacao',
    label: 'Em Qualificação',
    color: '#eab308', // yellow
    icon: ClipboardCheck,
    description: 'Leads que passaram pela análise de caso',
  },
  {
    key: 'qualificado',
    label: 'Qualificado',
    color: '#f97316', // orange
    icon: Star,
    description: 'Leads em negociação ou com contrato',
  },
  {
    key: 'cliente',
    label: 'Cliente',
    color: '#8b5cf6', // purple
    icon: Trophy,
    description: 'Leads que assinaram contrato',
  },
] as const;

export function CampaignMiniFunnel({ data }: CampaignMiniFunnelProps) {
  const totalLeads = data.total_leads || 0;
  
  // Don't render if no leads
  if (totalLeads === 0) return null;

  const getCount = (key: string): number => {
    switch (key) {
      case 'total_leads': return data.total_leads || 0;
      case 'atendidos': return data.atendidos || 0;
      case 'em_qualificacao': return data.em_qualificacao || 0;
      case 'qualificado': return data.qualificado || 0;
      case 'cliente': return data.cliente || 0;
      default: return 0;
    }
  };

  return (
    <TooltipProvider>
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Funil de Conversão
        </p>
        <div className="space-y-1.5">
          {FUNNEL_STAGES.map((stage, index) => {
            const count = getCount(stage.key);
            const percentage = totalLeads > 0 
              ? ((count / totalLeads) * 100).toFixed(0) 
              : '0';
            const widthPercent = totalLeads > 0 
              ? (count / totalLeads) * 100 
              : 0;
            const Icon = stage.icon;

            return (
              <Tooltip key={stage.key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Icon 
                      className="h-3 w-3 shrink-0" 
                      style={{ color: stage.color }}
                    />
                    <span className="text-xs text-muted-foreground w-24 truncate" title={stage.label}>
                      {stage.label}
                    </span>
                    <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max(widthPercent, count > 0 ? 8 : 0)}%`,
                          backgroundColor: stage.color 
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium min-w-[50px] text-right">
                      {count}
                      {index > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({percentage}%)
                        </span>
                      )}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">
                    {stage.description}
                    {index > 0 && ` — ${count} leads (${percentage}% do total)`}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
