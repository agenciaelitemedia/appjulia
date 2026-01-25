import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getDbDateGroupLabel, formatDbTime } from '@/lib/dateUtils';
import type { DashboardActivity } from '../hooks/useDashboardData';

interface DashboardActivityTimelineProps {
  activities: DashboardActivity[];
  isLoading?: boolean;
}

function groupActivitiesByDate(activities: DashboardActivity[]) {
  const groups: Record<string, DashboardActivity[]> = {};
  
  for (const activity of activities) {
    const label = getDbDateGroupLabel(activity.changed_at);
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(activity);
  }
  
  return groups;
}

export function DashboardActivityTimeline({
  activities,
  isLoading,
}: DashboardActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma movimentação encontrada no período.
      </p>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <ScrollArea className="h-[280px] pr-4">
      <div className="space-y-4">
        {Object.entries(groupedActivities).map(([dateLabel, dateActivities]) => (
          <div key={dateLabel}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {dateLabel}
            </p>
            <div className="space-y-2">
              {dateActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="text-xs text-muted-foreground w-10 flex-shrink-0 pt-0.5">
                    {formatDbTime(activity.changed_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {activity.changed_by || 'Sistema'}
                    </span>
                    <span className="text-muted-foreground"> moveu </span>
                    <span className="font-medium truncate">
                      {activity.contact_name}
                    </span>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {activity.from_stage_name && (
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0"
                          style={{
                            borderColor: activity.from_stage_color || undefined,
                            color: activity.from_stage_color || undefined,
                          }}
                        >
                          {activity.from_stage_name}
                        </Badge>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0"
                        style={{
                          borderColor: activity.to_stage_color || undefined,
                          color: activity.to_stage_color || undefined,
                        }}
                      >
                        {activity.to_stage_name}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
