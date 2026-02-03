import { useLocation } from 'react-router-dom';
import { useDebug } from '@/contexts/DebugContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  });
}

export function RoutePanel() {
  const location = useLocation();
  const { routeHistory, clearLogs } = useDebug();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            History: <span className="text-foreground font-medium">{routeHistory.length}</span> routes
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => clearLogs('route')}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      
      {/* Current Route */}
      <div className="px-3 py-2 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Current:</span>
          <span className="font-mono font-medium text-primary">{location.pathname}</span>
          {location.search && (
            <span className="font-mono text-muted-foreground">{location.search}</span>
          )}
        </div>
        {location.state && (
          <div className="mt-1 text-xs">
            <span className="text-muted-foreground">State:</span>
            <pre className="font-mono text-[11px] bg-background p-1 rounded mt-0.5 inline-block ml-2">
              {JSON.stringify(location.state)}
            </pre>
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        {routeHistory.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhuma navegação registrada
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {routeHistory.map((route, index) => (
              <div 
                key={route.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 text-xs",
                  index === 0 && "bg-muted/30"
                )}
              >
                <span className="text-muted-foreground w-6 shrink-0">{index + 1}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  GET
                </Badge>
                <span className="font-mono truncate flex-1">
                  {route.pathname}
                  {route.search && (
                    <span className="text-muted-foreground">{route.search}</span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatTime(route.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
