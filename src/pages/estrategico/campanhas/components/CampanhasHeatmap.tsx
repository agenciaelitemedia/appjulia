import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import { CampaignHeatmapCell } from '../types';
import { useMemo } from 'react';

interface CampanhasHeatmapProps {
  data: CampaignHeatmapCell[];
  isLoading: boolean;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CampanhasHeatmap({ data, isLoading }: CampanhasHeatmapProps) {
  // Create a map for quick lookup
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(cell => {
      map.set(`${cell.day}-${cell.hour}`, cell.count);
    });
    return map;
  }, [data]);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);

  // Find best hours - moved before early return
  const bestHours = useMemo(() => {
    const hourTotals = HOURS.map(hour => ({
      hour,
      total: DAYS.reduce((sum, _, dayIndex) => {
        return sum + (heatmapData.get(`${dayIndex}-${hour}`) || 0);
      }, 0),
    }));
    return hourTotals.sort((a, b) => b.total - a.total).slice(0, 3);
  }, [heatmapData]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-chart-2';
    if (intensity > 0.5) return 'bg-chart-2/80';
    if (intensity > 0.25) return 'bg-chart-2/60';
    return 'bg-chart-2/40';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Melhores Horários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Melhores Horários
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Distribuição de leads por dia e horário
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhum dado disponível para o período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Heatmap grid */}
            <div className="overflow-x-auto">
              <div className="inline-flex flex-col min-w-full">
                {/* Hours header */}
                <div className="flex">
                  <div className="w-12 flex-shrink-0" />
                  {HOURS.filter(h => h % 3 === 0).map(hour => (
                    <div 
                      key={hour} 
                      className="flex-1 text-xs text-muted-foreground text-center min-w-[20px]"
                      style={{ gridColumn: `span 3` }}
                    >
                      {hour}h
                    </div>
                  ))}
                </div>
                
                {/* Grid rows */}
                {DAYS.map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-0.5">
                    <div className="w-12 flex-shrink-0 text-xs text-muted-foreground">
                      {day}
                    </div>
                    <div className="flex gap-0.5 flex-1">
                      {HOURS.map(hour => {
                        const count = heatmapData.get(`${dayIndex}-${hour}`) || 0;
                        return (
                          <Tooltip key={hour}>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-3 h-6 rounded-sm cursor-pointer transition-all hover:scale-110 ${getColor(count)}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">
                                {day} às {hour}h: <strong>{count} leads</strong>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t">
              <span className="text-xs text-muted-foreground">Menos</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded bg-muted/30" />
                <div className="w-4 h-4 rounded bg-chart-2/40" />
                <div className="w-4 h-4 rounded bg-chart-2/60" />
                <div className="w-4 h-4 rounded bg-chart-2/80" />
                <div className="w-4 h-4 rounded bg-chart-2" />
              </div>
              <span className="text-xs text-muted-foreground">Mais</span>
            </div>
            
            {/* Best hours summary */}
            {bestHours.some(h => h.total > 0) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Top horários:</span>
                {bestHours.filter(h => h.total > 0).map(({ hour, total }) => (
                  <span key={hour} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {hour}h ({total} leads)
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
