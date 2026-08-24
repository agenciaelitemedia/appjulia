import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn, MascoteLoader } from '../extend/ui';
import type { JuliaChatFilters } from '../api/types';

type StatusValue = NonNullable<JuliaChatFilters['status']>;

interface Props {
  value: JuliaChatFilters['status'];
  onChange: (v: StatusValue) => void;
  counters?: { pending?: number; open?: number; closed?: number } | null;
  /** Exibe spinner no contador da aba ativa enquanto carrega. */
  loading?: boolean;
}

/** Abas de status — mesmo padrão visual do /chat. */
export function JuliaChatStatusTabs({ value, onChange, counters, loading }: Props) {
  const tabs: { value: StatusValue; label: string; count?: number; tooltip: string }[] = [
    {
      value: 'resolved_closed',
      label: 'Encerradas',
      count: counters?.closed,
      tooltip: 'Resolvidas / Encerradas',
    },
    { value: 'pending', label: 'Aguardando', count: counters?.pending ?? 0, tooltip: 'Conversas aguardando atendimento' },
    { value: 'open', label: 'Atendimento', count: counters?.open ?? 0, tooltip: 'Conversas em atendimento ativo' },
  ];

  return (
    <div className="flex shrink-0 border-b">
      <TooltipProvider delayDuration={200}>
        {tabs.map((tab) => {
          const active = value === tab.value;
          return (
            <Tooltip key={tab.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(tab.value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold transition-colors',
                    active
                      ? tab.value === 'pending'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : tab.value === 'open'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-primary bg-primary/10 text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className="whitespace-pre-line leading-tight">{tab.label}</span>
                  {active && loading ? (
                    <span className="flex h-4 min-w-[18px] items-center justify-center overflow-hidden rounded-full bg-muted/60">
                      <MascoteLoader size="xs" className="scale-75" />
                    </span>
                  ) : tab.count != null && (
                    <span
                      className={cn(
                        'flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                        active
                          ? 'bg-muted text-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {tab.count >= 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{tab.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
