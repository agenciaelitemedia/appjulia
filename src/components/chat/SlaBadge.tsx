import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SlaEvaluation, formatRemaining } from '@/hooks/useChatSlaConfigs';

interface SlaBadgeProps {
  evaluation: SlaEvaluation;
  compact?: boolean;
  className?: string;
}

export function SlaBadge({ evaluation, compact, className }: SlaBadgeProps) {
  if (evaluation.status === 'unknown') return null;

  const styles: Record<string, { bg: string; icon: any; text: string }> = {
    on_track: { bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, text: 'SLA OK' },
    at_risk: { bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', icon: Clock, text: 'SLA próximo' },
    breached: { bg: 'bg-destructive/15 text-destructive', icon: AlertTriangle, text: 'SLA estourado' },
  };
  const s = styles[evaluation.status];
  if (!s) return null;
  const Icon = s.icon;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5',
          s.bg,
          className
        )}
        title={`${evaluation.label}: ${formatRemaining(evaluation.remainingMinutes)}`}
      >
        <Icon className="h-2.5 w-2.5" />
        {formatRemaining(evaluation.remainingMinutes)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md',
        s.bg,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{s.text}</span>
      <span className="opacity-75">• {formatRemaining(evaluation.remainingMinutes)}</span>
    </span>
  );
}
