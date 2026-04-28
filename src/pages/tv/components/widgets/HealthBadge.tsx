import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react';

export type HealthState = 'good' | 'warn' | 'bad';

const STATE: Record<HealthState, { color: string; bg: string; border: string; Icon: LucideIcon; label: string }> = {
  good:  { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', Icon: CheckCircle2,  label: 'OK' },
  warn:  { color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   Icon: AlertTriangle, label: 'Atenção' },
  bad:   { color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/40',    Icon: XCircle,       label: 'Crítico' },
};

/**
 * Card de saúde semáforo. Para a faixa fixa do topo da TV.
 */
export function HealthBadge({
  label,
  state,
  primary,
  secondary,
  pulse = false,
  className,
}: {
  label: string;
  state: HealthState;
  primary: string | number;
  secondary?: string;
  pulse?: boolean;
  className?: string;
}) {
  const s = STATE[state];
  return (
    <div className={cn(
      'rounded-2xl border p-5 flex items-center gap-4 min-h-[120px]',
      s.bg, s.border,
      pulse && state === 'bad' && 'animate-pulse',
      className,
    )}>
      <s.Icon className={cn('h-12 w-12 shrink-0', s.color)} />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400">{label}</div>
        <div className={cn('text-4xl font-bold tabular-nums leading-tight', s.color)}>{primary}</div>
        {secondary && <div className="text-sm text-zinc-300 truncate">{secondary}</div>}
      </div>
    </div>
  );
}
