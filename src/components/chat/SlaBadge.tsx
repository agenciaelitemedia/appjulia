import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SlaEvaluation, formatRemaining } from '@/hooks/useChatSlaConfigs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface SlaBadgeProps {
  evaluation: SlaEvaluation;
  compact?: boolean;
  className?: string;
}

const SLA_TYPE_DESCRIPTIONS: Record<string, string> = {
  frt: 'Aguardando a primeira resposta do atendente.',
  nrt: 'Cliente aguardando resposta do atendente.',
  ttr: 'Tempo para encerrar/resolver esta conversa.',
};

export function SlaBadge({ evaluation, compact, className }: SlaBadgeProps) {
  if (evaluation.status === 'unknown') return null;

  const styles: Record<string, { bg: string; icon: any; text: string }> = {
    on_track: { bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, text: 'SLA OK' },
    at_risk:  { bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',       icon: Clock,        text: 'SLA próximo' },
    breached: { bg: 'bg-destructive/15 text-destructive',                        icon: AlertTriangle, text: 'SLA estourado' },
  };
  const s = styles[evaluation.status];
  if (!s) return null;
  const Icon = s.icon;

  const typeLabel = evaluation.slaTypeLabel ?? '';
  const timeStr = formatRemaining(evaluation.remainingMinutes);
  const typeDesc = SLA_TYPE_DESCRIPTIONS[evaluation.slaType] ?? '';
  const tooltipText = `${typeLabel} — ${typeDesc} ${evaluation.remainingMinutes < 0 ? `Atrasado ${timeStr}` : `Restam ${timeStr}`}`;

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center justify-center gap-1 h-5 px-1.5 text-[9px] font-bold leading-none whitespace-nowrap overflow-hidden',
                s.bg,
                className
              )}
            >
              <Icon className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{timeStr}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            <p className="font-semibold mb-0.5">{typeLabel}</p>
            <p className="text-muted-foreground">{typeDesc}</p>
            <p className="mt-1">{evaluation.remainingMinutes < 0 ? `Atrasado ${timeStr}` : `Restam ${timeStr}`}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md cursor-default',
              s.bg,
              className
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{typeLabel}</span>
            <span className="opacity-75">• {timeStr}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          <p className="font-semibold mb-0.5">{typeLabel}</p>
          <p className="text-muted-foreground">{typeDesc}</p>
          <p className="mt-1">{evaluation.remainingMinutes < 0 ? `Atrasado ${timeStr}` : `Restam ${timeStr}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
