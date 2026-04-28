import { cn } from '@/lib/utils';

export interface RankingItem {
  id: string;
  label: string;
  value: number;
  secondaryLabel?: string;
  trail?: string;
}

/**
 * Lista de itens com barra horizontal de progresso, otimizada p/ TV.
 */
export function BarRanking({
  items,
  maxValue,
  className,
  barColor = 'bg-violet-500',
}: {
  items: RankingItem[];
  maxValue?: number;
  className?: string;
  barColor?: string;
}) {
  const max = maxValue ?? Math.max(1, ...items.map(i => i.value));
  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, idx) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-bold text-zinc-500 tabular-nums w-6">{idx + 1}</span>
                <span className="text-lg font-medium text-zinc-100 truncate">{item.label}</span>
                {item.secondaryLabel && (
                  <span className="text-sm text-zinc-400 shrink-0">{item.secondaryLabel}</span>
                )}
              </div>
              <span className="text-xl font-bold tabular-nums text-zinc-200 shrink-0">
                {item.value.toLocaleString('pt-BR')}
                {item.trail && <span className="text-sm text-zinc-400 ml-1">{item.trail}</span>}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="text-center text-sm text-zinc-500 py-6">Sem dados</div>
      )}
    </div>
  );
}
