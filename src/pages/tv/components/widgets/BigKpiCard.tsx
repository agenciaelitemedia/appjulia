import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KpiTone = 'neutral' | 'good' | 'warn' | 'bad';

export function BigKpiCard({
  label,
  value,
  unit,
  delta,
  tone = 'neutral',
  className,
  pulse = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; positive_is_good?: boolean };
  tone?: KpiTone;
  className?: string;
  pulse?: boolean;
}) {
  const toneClasses: Record<KpiTone, string> = {
    neutral: 'border-zinc-800 bg-zinc-900/50',
    good: 'border-emerald-500/40 bg-emerald-500/10',
    warn: 'border-amber-500/40 bg-amber-500/10',
    bad: 'border-rose-500/40 bg-rose-500/10',
  };
  const valueColor: Record<KpiTone, string> = {
    neutral: 'text-zinc-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-rose-300',
  };

  const renderDelta = () => {
    if (!delta) return null;
    const positiveGood = delta.positive_is_good ?? true;
    const isPositive = delta.value > 0;
    const isGood = positiveGood ? isPositive : !isPositive;
    const isZero = delta.value === 0;
    const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown;
    const color = isZero ? 'text-zinc-400' : isGood ? 'text-emerald-400' : 'text-rose-400';
    return (
      <div className={cn('flex items-center gap-1.5 text-base font-medium', color)}>
        <Icon className="h-5 w-5" />
        {delta.value > 0 ? '+' : ''}{delta.value}%
      </div>
    );
  };

  return (
    <div className={cn(
      'rounded-2xl border p-6 flex flex-col justify-between min-h-[180px]',
      toneClasses[tone],
      pulse && tone === 'bad' && 'animate-pulse',
      className,
    )}>
      <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('text-7xl font-bold tabular-nums leading-none', valueColor[tone])}>
          {value}
        </span>
        {unit && <span className="text-2xl text-zinc-400 mb-2 font-medium">{unit}</span>}
      </div>
      {renderDelta()}
    </div>
  );
}
