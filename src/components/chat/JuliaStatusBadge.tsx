import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { cn } from '@/lib/utils';

interface JuliaStatusBadgeProps {
  whatsappNumber?: string | null;
  codAgent?: string | null;
  className?: string;
}

/**
 * Compact badge showing Julia (J / green) when AI is active,
 * or Atendimento Humano (H / red) when handed off to human.
 * Returns null if status is unknown.
 */
export function JuliaStatusBadge({ whatsappNumber, codAgent, className }: JuliaStatusBadgeProps) {
  const { isActive } = useAgentSessionStatus(whatsappNumber, codAgent);
  if (isActive === null || isActive === undefined) return null;

  const active = isActive === true;
  return (
    <span
      title={active ? 'Julia ativa' : 'Atendimento Humano'}
      className={cn(
        'inline-flex items-center justify-center text-[10px] font-bold rounded h-4 w-4 shrink-0',
        active
          ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30'
          : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
        className
      )}
    >
      {active ? 'J' : 'H'}
    </span>
  );
}

export type JuliaStatusFilter = 'all' | 'active' | 'inactive';
