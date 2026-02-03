import { useDebug, QueryLog } from '@/contexts/DebugContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(date: Date): string {
  const time = date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  });
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${time}.${ms}`;
}

function QueryRow({ query, index }: { query: QueryLog; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const durationColor = query.duration < 100 
    ? 'text-green-500' 
    : query.duration < 500 
      ? 'text-yellow-500' 
      : 'text-red-500';

  return (
    <div className="border-b border-border/50 last:border-0">
      <div 
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-xs",
          query.error && "bg-destructive/10"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-muted-foreground w-6 shrink-0">{index + 1}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
          {query.action}
        </Badge>
        <span className="font-mono truncate flex-1">
          {query.query || query.action}
        </span>
        <span className={cn("font-mono shrink-0", durationColor)}>
          {formatDuration(query.duration)}
        </span>
        <span className="text-muted-foreground shrink-0">
          {formatTime(query.timestamp)}
        </span>
        {query.error && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">
            Error
          </Badge>
        )}
      </div>
      
      {expanded && (
        <div className="px-4 py-2 bg-muted/30 text-xs space-y-2">
          {query.query && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground font-medium">Query:</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(query.query || '')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {query.query}
              </pre>
            </div>
          )}
          
          {query.params && query.params.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">Params:</span>
              <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1">
                {JSON.stringify(query.params, null, 2)}
              </pre>
            </div>
          )}
          
          {query.error && (
            <div>
              <span className="text-destructive font-medium">Error:</span>
              <pre className="font-mono text-[11px] bg-destructive/10 text-destructive p-2 rounded overflow-x-auto mt-1">
                {query.error}
              </pre>
            </div>
          )}
          
          {query.result && !query.error && (
            <div>
              <span className="text-muted-foreground font-medium">Result ({Array.isArray(query.result) ? query.result.length : 1} rows):</span>
              <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1 max-h-32">
                {JSON.stringify(query.result, null, 2).slice(0, 500)}
                {JSON.stringify(query.result).length > 500 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QueriesPanel() {
  const { queries, clearLogs } = useDebug();

  const totalTime = queries.reduce((acc, q) => acc + q.duration, 0);
  const errorCount = queries.filter(q => q.error).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{queries.length}</span> queries
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
          onClick={() => clearLogs('queries')}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {queries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhuma query registrada
          </div>
        ) : (
          queries.map((query, index) => (
            <QueryRow key={query.id} query={query} index={index} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
