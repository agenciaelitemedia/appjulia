import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CRMActivityLog } from '../../types';

interface ActivityTimelineProps {
  activities: CRMActivityLog[];
  isLoading?: boolean;
}

function formatActivityDate(dateStr: string): string {
  const date = new Date(dateStr);
  
  if (isToday(date)) {
    return `Hoje, ${format(date, 'HH:mm', { locale: ptBR })}`;
  }
  
  if (isYesterday(date)) {
    return `Ontem, ${format(date, 'HH:mm', { locale: ptBR })}`;
  }
  
  return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
}

function groupActivitiesByDate(activities: CRMActivityLog[]) {
  const groups: { [key: string]: CRMActivityLog[] } = {};
  
  activities.forEach(activity => {
    const date = new Date(activity.changed_at);
    let key: string;
    
    if (isToday(date)) {
      key = 'Hoje';
    } else if (isYesterday(date)) {
      key = 'Ontem';
    } else {
      key = format(date, "dd 'de' MMMM", { locale: ptBR });
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(activity);
  });
  
  return groups;
}

export function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="font-medium">Nenhuma atividade recente</p>
            <p className="text-sm">As movimentações aparecerão aqui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="p-4">
            {Object.entries(groupedActivities).map(([dateLabel, dayActivities]) => (
              <div key={dateLabel} className="mb-4 last:mb-0">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  {dateLabel}
                </h4>
                <div className="space-y-2">
                  {dayActivities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 text-xs text-muted-foreground">
                        {format(new Date(activity.changed_at), 'HH:mm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium text-foreground">
                            {activity.changed_by || 'Sistema'}
                          </span>
                          {' moveu '}
                          <span className="font-medium text-foreground">
                            {activity.contact_name || activity.whatsapp_number}
                          </span>
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {activity.from_stage_name && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: activity.from_stage_color }}
                            >
                              {activity.from_stage_name}
                            </Badge>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: activity.to_stage_color }}
                          >
                            {activity.to_stage_name}
                          </Badge>
                        </div>
                        {activity.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{activity.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
