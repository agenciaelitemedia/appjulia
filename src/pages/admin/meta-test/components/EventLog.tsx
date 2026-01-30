import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { EventLogEntry } from '../types';

interface EventLogProps {
  events: EventLogEntry[];
}

export function EventLog({ events }: EventLogProps) {
  const getEventColor = (type: string) => {
    if (type.includes('ERROR') || type.includes('CANCEL')) return 'destructive';
    if (type.includes('SUCCESS') || type.includes('FINISH')) return 'default';
    if (type.includes('STARTED') || type.includes('STEP')) return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Eventos Capturados</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum evento capturado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs font-mono"
                >
                  <span className="text-muted-foreground shrink-0">
                    [{format(event.timestamp, 'HH:mm:ss')}]
                  </span>
                  <Badge variant={getEventColor(event.type)} className="shrink-0">
                    {event.type}
                  </Badge>
                  {event.data && (
                    <span className="text-muted-foreground truncate">
                      {JSON.stringify(event.data).substring(0, 50)}...
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
