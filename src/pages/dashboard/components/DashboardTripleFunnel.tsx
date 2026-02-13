import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowDown, Bot, Megaphone, Leaf } from 'lucide-react';
import type { DashboardFunnelStage } from '../hooks/useDashboardFunnels';

interface FunnelCardProps {
  title: string;
  icon: React.ReactNode;
  stages: DashboardFunnelStage[];
  isLoading: boolean;
}

function FunnelCard({ title, icon, stages, isLoading }: FunnelCardProps) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-card to-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center space-y-1.5">
          {stages.map((stage, index) => {
            const widthPercent = Math.max(35, (stage.count / maxCount) * 100);
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.position} className="w-full flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <div
                        className="relative py-3 px-3 rounded-lg flex items-center justify-between min-h-[52px] transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${stage.stage_color}dd, ${stage.stage_color}99)`,
                          boxShadow: `0 4px 15px ${stage.stage_color}40`,
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-white font-semibold text-xs md:text-sm">
                            {stage.stage_name}
                          </span>
                          <span className="text-white/80 text-[10px]">
                            {stage.percentage.toFixed(0)}% do total
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-white text-xl md:text-2xl font-bold">
                            {stage.count}
                          </span>
                        </div>
                        <div
                          className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-white/30"
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{stage.stage_name}</p>
                      <p className="font-medium">{stage.count} leads ({stage.percentage.toFixed(1)}%)</p>
                      {index > 0 && (
                        <p className="text-muted-foreground text-xs">
                          Taxa de conversão: {stage.conversionRate.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {!isLast && (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                      {stages[index + 1]?.conversionRate?.toFixed(0) || 0}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {stages.every(s => s.count === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Sem dados no período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardTripleFunnelProps {
  juliaData: DashboardFunnelStage[];
  campaignData: DashboardFunnelStage[];
  organicData: DashboardFunnelStage[];
  juliaLoading: boolean;
  campaignLoading: boolean;
  organicLoading: boolean;
}

export function DashboardTripleFunnel({ juliaData, campaignData, organicData, juliaLoading, campaignLoading, organicLoading }: DashboardTripleFunnelProps) {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <FunnelCard
        title="Funil Total Julia"
        icon={<Bot className="h-5 w-5 text-primary" />}
        stages={juliaData}
        isLoading={juliaLoading}
      />
      <FunnelCard
        title="Funil Campanhas"
        icon={<Megaphone className="h-5 w-5 text-primary" />}
        stages={campaignData}
        isLoading={campaignLoading}
      />
      <FunnelCard
        title="Funil Orgânicos"
        icon={<Leaf className="h-5 w-5 text-primary" />}
        stages={organicData}
        isLoading={organicLoading}
      />
    </div>
  );
}
