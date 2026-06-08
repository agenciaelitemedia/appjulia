import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { evaluateTicketSla } from '../hooks/useTickets';
import type { SupportTicket } from '../types';

const TYPE_DESC: Record<string, string> = {
  frt: 'Aguardando a primeira resposta do atendente.',
  ttr: 'Tempo para encerrar/resolver este chamado.',
};

function formatRemaining(minutes: number): string {
  const abs = Math.abs(minutes);
  const prefix = minutes < 0 ? '+' : '';
  if (abs < 60) return `${prefix}${abs}min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `${prefix}${h}h${m}m` : `${prefix}${h}h`;
}

interface Props {
  ticket: SupportTicket;
  compact?: boolean;
  className?: string;
}

export function TicketSlaBadge({ ticket, compact, className }: Props) {
  const ev = evaluateTicketSla(ticket);
  if (ev.status === 'unknown') return null;

  const styles: Record<string, { bg: string; icon: any; text: string }> = {
    on_track: { bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, text: 'SLA OK' },
    at_risk:  { bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',       icon: Clock,        text: 'SLA próximo' },
    breached: { bg: 'bg-destructive/15 text-destructive',                        icon: AlertTriangle, text: 'SLA estourado' },
  };
  const s = styles[ev.status];
  const Icon = s.icon;
  const timeStr = formatRemaining(ev.remainingMinutes);
  const typeDesc = TYPE_DESC[ev.slaType] ?? '';
  const isDone = ['resolved', 'closed'].includes(ticket.status);

  const tooltip = (
    <TooltipContent side="top" className="max-w-[240px] text-xs">
      <p className="font-semibold mb-0.5">{isDone ? 'Concluído' : ev.slaTypeLabel}</p>
      {!isDone && <p className="text-muted-foreground">{typeDesc}</p>}
      {!isDone && (
        <p className="mt-1">{ev.remainingMinutes < 0 ? `Atrasado ${timeStr}` : `Restam ${timeStr}`}</p>
      )}
    </TooltipContent>
  );

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center justify-center gap-1 h-5 px-1.5 rounded text-[10px] font-bold leading-none whitespace-nowrap',
                s.bg,
                className,
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {!isDone && <span>{timeStr}</span>}
              {isDone && <span>OK</span>}
            </span>
          </TooltipTrigger>
          {tooltip}
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
              className,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{isDone ? 'Concluído' : ev.slaTypeLabel}</span>
            {!isDone && <span className="opacity-75">• {timeStr}</span>}
          </span>
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
    </TooltipProvider>
  );
}