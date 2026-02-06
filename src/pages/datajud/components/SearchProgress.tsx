import { useMemo } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SearchProgressProps {
  isSearching: boolean;
  searchedTribunals: number;
  totalTribunals: number;
  responseTime: number;
  resultsCount: number;
}

export function SearchProgress({
  isSearching,
  searchedTribunals,
  totalTribunals,
  responseTime,
  resultsCount,
}: SearchProgressProps) {
  const progress = useMemo(() => {
    if (totalTribunals === 0) return 0;
    return Math.round((searchedTribunals / totalTribunals) * 100);
  }, [searchedTribunals, totalTribunals]);

  if (!isSearching && searchedTribunals === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-muted-foreground">
                  Consultando tribunais...
                </span>
              </>
            ) : resultsCount > 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-foreground font-medium">
                  Busca concluída
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Nenhum resultado encontrado
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              {searchedTribunals} de {totalTribunals} tribunais
            </span>
            {responseTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{(responseTime / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>

        <Progress
          value={isSearching ? undefined : 100}
          className={cn(
            'h-2 transition-all duration-500',
            isSearching && 'animate-pulse'
          )}
        />
      </div>

      {/* Results summary */}
      {!isSearching && resultsCount > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Encontrados
          </span>
          <span className="font-semibold text-primary">
            {resultsCount} processo{resultsCount !== 1 && 's'}
          </span>
        </div>
      )}
    </div>
  );
}
