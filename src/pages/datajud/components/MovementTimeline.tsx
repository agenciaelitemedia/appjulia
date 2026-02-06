import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, ArrowDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProcessMovement } from '../types';

interface MovementTimelineProps {
  movements: ProcessMovement[];
  maxItems?: number;
  showAll?: boolean;
}

export function MovementTimeline({ movements, maxItems = 10, showAll = false }: MovementTimelineProps) {
  const displayMovements = showAll ? movements : movements.slice(0, maxItems);
  const hasMore = !showAll && movements.length > maxItems;

  if (!movements || movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Circle className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhuma movimentação encontrada</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />

      <div className="space-y-0">
        {displayMovements.map((movement, index) => {
          const isFirst = index === 0;
          const isLast = index === displayMovements.length - 1;
          
          let formattedDate = '-';
          try {
            if (movement.dataHora) {
              formattedDate = format(new Date(movement.dataHora), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                locale: ptBR,
              });
            }
          } catch {
            formattedDate = movement.dataHora;
          }

          return (
            <div
              key={`${movement.codigo}-${movement.dataHora}-${index}`}
              className={cn(
                'relative pl-10 pr-4 py-4',
                'group hover:bg-muted/50 rounded-lg transition-colors',
                isFirst && 'pt-2',
                isLast && 'pb-2'
              )}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  'transition-all duration-200',
                  isFirst
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background border-muted-foreground/30 group-hover:border-primary/50'
                )}
              >
                {isFirst ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 group-hover:bg-primary/50 transition-colors" />
                )}
              </div>

              {/* Content */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <h4
                    className={cn(
                      'text-sm font-medium leading-tight',
                      isFirst ? 'text-foreground' : 'text-foreground/80'
                    )}
                  >
                    {movement.nome}
                  </h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {movement.codigo}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{formattedDate}</p>

                {/* Complements */}
                {movement.complementosTabelados && movement.complementosTabelados.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {movement.complementosTabelados.map((comp, i) => (
                      <span
                        key={`${comp.codigo}-${i}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground"
                      >
                        {comp.descricao || comp.nome}
                        {comp.valor !== undefined && `: ${comp.valor}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="relative pl-10 pr-4 py-4 text-center">
            <div className="absolute left-2 w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">...</span>
            </div>
            <p className="text-sm text-muted-foreground">
              +{movements.length - maxItems} movimentações anteriores
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
