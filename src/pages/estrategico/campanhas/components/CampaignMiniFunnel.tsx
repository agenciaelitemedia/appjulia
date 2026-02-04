import { Users } from 'lucide-react';
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

export function CampaignMiniFunnel({ data }: CampaignMiniFunnelProps) {
  const totalLeads = data.total_leads || 0;
  const stages = data.stages || [];
  
  // Don't render if no leads
  if (totalLeads === 0) return null;

  // Find max count for bar width calculation
  const maxCount = Math.max(totalLeads, ...stages.map(s => s.count));

  return (
    <TooltipProvider>
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Funil CRM ({totalLeads} leads)
        </p>
        <div className="space-y-1.5">
          {/* Total de leads da campanha */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-20 truncate">
                  Total da campanha
                </span>
                <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(totalLeads / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium min-w-[40px] text-right">
                  {totalLeads}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">Total de leads desta campanha</p>
            </TooltipContent>
          </Tooltip>

          {/* Stages do CRM */}
          {stages.map((stage) => {
            const percentage = totalLeads > 0 
              ? ((stage.count / totalLeads) * 100).toFixed(0) 
              : '0';
            const widthPercent = (stage.count / maxCount) * 100;

            return (
              <Tooltip key={stage.stage_id}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <div 
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.stage_color }}
                    />
                    <span className="text-xs text-muted-foreground w-20 truncate" title={stage.stage_name}>
                      {stage.stage_name}
                    </span>
                    <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max(widthPercent, stage.count > 0 ? 8 : 0)}%`,
                          backgroundColor: stage.stage_color 
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium min-w-[40px] text-right">
                      {stage.count}
                      <span className="text-muted-foreground ml-1">
                        ({percentage}%)
                      </span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">
                    {stage.count} leads em "{stage.stage_name}" ({percentage}% do total)
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Empty state quando não há cards no CRM */}
          {stages.length === 0 && (
            <p className="text-xs text-muted-foreground italic pl-5">
              Nenhum lead correlacionado no CRM
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
