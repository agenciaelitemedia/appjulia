import { useDebug, NetworkLog } from '@/contexts/DebugContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  });
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    case 'POST': return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'PUT': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'PATCH': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    case 'DELETE': return 'bg-red-500/20 text-red-500 border-red-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function getStatusColor(status: number): string {
  if (status === 0) return 'text-muted-foreground';
  if (status < 300) return 'text-green-500';
  if (status < 400) return 'text-yellow-500';
  return 'text-red-500';
}

function NetworkRow({ request, index }: { request: NetworkLog; index: number }) {
  const [expanded, setExpanded] = useState(false);

  // Extract path from URL
  const getPath = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  return (
    <div className="border-b border-border/50 last:border-0">
      <div 
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-xs",
          request.error && "bg-destructive/10"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-muted-foreground w-6 shrink-0">{index + 1}</span>
        <Badge 
          variant="outline" 
          className={cn("text-[10px] px-1.5 py-0 shrink-0 font-mono", getMethodColor(request.method))}
        >
          {request.method}
        </Badge>
        <span className={cn("font-medium shrink-0 w-10", getStatusColor(request.status))}>
          {request.status || 'ERR'}
        </span>
        <span className="font-mono truncate flex-1" title={request.url}>
          {getPath(request.url)}
        </span>
        <span className={cn(
          "font-mono shrink-0",
          request.duration < 200 ? 'text-green-500' : request.duration < 1000 ? 'text-yellow-500' : 'text-red-500'
        )}>
          {formatDuration(request.duration)}
        </span>
        <span className="text-muted-foreground shrink-0">
          {formatTime(request.timestamp)}
        </span>
      </div>
      
      {expanded && (
        <div className="px-4 py-2 bg-muted/30 text-xs space-y-2">
          <div>
            <span className="text-muted-foreground font-medium">URL:</span>
            <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1 break-all">
              {request.url}
            </pre>
          </div>
          
          {request.requestBody && (
            <div>
              <span className="text-muted-foreground font-medium">Request Body:</span>
              <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1 max-h-32">
                {JSON.stringify(request.requestBody, null, 2)}
              </pre>
            </div>
          )}
          
          {request.error && (
            <div>
              <span className="text-destructive font-medium">Error:</span>
              <pre className="font-mono text-[11px] bg-destructive/10 text-destructive p-2 rounded overflow-x-auto mt-1">
                {request.error}
              </pre>
            </div>
          )}
          
          {request.responseBody && !request.error && (
            <div>
              <span className="text-muted-foreground font-medium">Response:</span>
              <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1 max-h-32">
                {typeof request.responseBody === 'string' 
                  ? request.responseBody.slice(0, 500) 
                  : JSON.stringify(request.responseBody, null, 2).slice(0, 500)}
                {(typeof request.responseBody === 'string' 
                  ? request.responseBody.length 
                  : JSON.stringify(request.responseBody).length) > 500 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NetworkPanel() {
  const { networkRequests, clearLogs } = useDebug();

  const totalTime = networkRequests.reduce((acc, r) => acc + r.duration, 0);
  const errorCount = networkRequests.filter(r => r.error || r.status >= 400).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{networkRequests.length}</span> requests
          </span>
          <span className="text-muted-foreground">
            Time: <span className="text-foreground font-medium">{formatDuration(totalTime)}</span>
          </span>
          {errorCount > 0 && (
            <span className="text-destructive">
              Errors: <span className="font-medium">{errorCount}</span>
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => clearLogs('network')}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {networkRequests.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhuma requisição registrada
          </div>
        ) : (
          networkRequests.map((request, index) => (
            <NetworkRow key={request.id} request={request} index={index} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
