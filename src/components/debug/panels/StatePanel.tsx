import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface QueryInfo {
  queryKey: readonly unknown[];
  status: string;
  fetchStatus: string;
  dataUpdatedAt: number;
  isStale: boolean;
  dataPreview: string;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'success': return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'error': return 'bg-red-500/20 text-red-500 border-red-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function QueryRow({ query, index }: { query: QueryInfo; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const queryKeyStr = JSON.stringify(query.queryKey);

  return (
    <div className="border-b border-border/50 last:border-0">
      <div 
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-xs"
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
          className={cn("text-[10px] px-1.5 py-0 shrink-0", getStatusColor(query.status))}
        >
          {query.status}
        </Badge>
        {query.fetchStatus === 'fetching' && (
          <RefreshCw className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
        )}
        {query.isStale && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-500/20 text-orange-500 border-orange-500/30">
            stale
          </Badge>
        )}
        <span className="font-mono truncate flex-1" title={queryKeyStr}>
          {queryKeyStr}
        </span>
        <span className="text-muted-foreground shrink-0">
          {formatTime(query.dataUpdatedAt)}
        </span>
      </div>
      
      {expanded && (
        <div className="px-4 py-2 bg-muted/30 text-xs space-y-2">
          <div>
            <span className="text-muted-foreground font-medium">Query Key:</span>
            <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1">
              {JSON.stringify(query.queryKey, null, 2)}
            </pre>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground font-medium">Status:</span>
              <span className="ml-2 font-mono">{query.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Fetch Status:</span>
              <span className="ml-2 font-mono">{query.fetchStatus}</span>
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground font-medium">Data Preview:</span>
            <pre className="font-mono text-[11px] bg-background p-2 rounded overflow-x-auto mt-1 max-h-32">
              {query.dataPreview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatePanel() {
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const queries = useMemo(() => {
    // Force re-compute when refreshKey changes
    void refreshKey;
    
    return queryClient.getQueryCache().getAll().map(query => {
      let dataPreview = '';
      try {
        const data = query.state.data;
        if (data === undefined) {
          dataPreview = 'undefined';
        } else if (data === null) {
          dataPreview = 'null';
        } else {
          const str = JSON.stringify(data, null, 2);
          dataPreview = str.length > 500 ? str.slice(0, 500) + '...' : str;
        }
      } catch {
        dataPreview = '[Unable to serialize]';
      }

      return {
        queryKey: query.queryKey,
        status: query.state.status,
        fetchStatus: query.state.fetchStatus,
        dataUpdatedAt: query.state.dataUpdatedAt,
        isStale: query.isStale(),
        dataPreview,
      };
    });
  }, [queryClient, refreshKey]);

  const activeCount = queries.filter(q => q.fetchStatus === 'fetching').length;
  const staleCount = queries.filter(q => q.isStale).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{queries.length}</span> queries
          </span>
          {activeCount > 0 && (
            <span className="text-blue-500">
              Fetching: <span className="font-medium">{activeCount}</span>
            </span>
          )}
          {staleCount > 0 && (
            <span className="text-orange-500">
              Stale: <span className="font-medium">{staleCount}</span>
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => setRefreshKey(k => k + 1)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {queries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhuma query no cache
          </div>
        ) : (
          queries.map((query, index) => (
            <QueryRow key={JSON.stringify(query.queryKey)} query={query} index={index} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
