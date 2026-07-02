import { Bot, User } from 'lucide-react';
import { useAgentSessionStatus } from '@/hooks/useAgentSessionStatus';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { cn } from '@/lib/utils';

interface ConversationStatusBadgeProps {
  /** Legacy: phone (whatsapp) for direct Julia session lookup */
  whatsappNumber?: string | null;
  /** Legacy: cod_agent for direct Julia session lookup */
  codAgent?: string | null;
  /** New: queue id of the conversation — drives Bot vs Human icon */
  queueId?: string | null;
  /** New: assigned_to for queues without an AI agent */
  assignedTo?: string | null;
  className?: string;
}

/**
 * Contextual status badge.
 * - With `queueId` (chat module): resolves the queue → if it has an AI agent, shows
 *   a Bot icon (green=Julia ativa, red=inativa); otherwise shows a User icon
 *   (green=atendente atribuído, red=sem atendente).
 * - Without `queueId` (legacy callers like /atendimento-humano, CRM, Campanhas):
 *   falls back to the original J/H badge based on `whatsappNumber`+`codAgent`.
 */
export function ConversationStatusBadge({
  whatsappNumber,
  codAgent,
  queueId,
  assignedTo,
  className,
}: ConversationStatusBadgeProps) {
  // ---- New mode (queueId provided) ----
  if (queueId) {
    return (
      <QueueModeBadge
        queueId={queueId}
        whatsappNumber={whatsappNumber}
        fallbackCodAgent={codAgent}
        assignedTo={assignedTo}
        className={className}
      />
    );
  }

  // ---- Legacy J/H mode ----
  return (
    <LegacyJuliaBadge
      whatsappNumber={whatsappNumber}
      codAgent={codAgent}
      className={className}
    />
  );
}

function QueueModeBadge({
  queueId,
  whatsappNumber,
  fallbackCodAgent,
  assignedTo,
  className,
}: {
  queueId: string;
  whatsappNumber?: string | null;
  fallbackCodAgent?: string | null;
  assignedTo?: string | null;
  className?: string;
}) {
  const { data: link, isLoading: loadingLink } = useQueueAgentLink(queueId);
  const resolvedCodAgent = link?.codAgent || fallbackCodAgent || null;
  const hasAgent = !!link?.hasAgent;

  // Always call the hook (rules of hooks). It returns null when args are missing.
  const { isActive } = useAgentSessionStatus(
    hasAgent ? whatsappNumber : null,
    hasAgent ? resolvedCodAgent : null,
  );

  if (loadingLink) return <div className="h-4 w-4 shrink-0 rounded bg-muted animate-pulse" />;

  if (hasAgent) {
    // No session record => treat as inactive (humano), not "missing badge".
    const active = isActive === true;
    return (
      <Pill
        active={active}
        Icon={Bot}
        title={active ? 'Julia ativa' : 'Julia inativa (humano assumiu)'}
        className={className}
      />
    );
  }

  // Queue without AI agent → human icon
  const hasAssignee = !!(assignedTo && assignedTo.trim());
  return (
    <span
      title={hasAssignee ? `Atendente: ${assignedTo}` : 'Sem atendente atribuído'}
      className={cn(
        'inline-flex items-center justify-center rounded h-4 w-4 shrink-0 border',
        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        className,
      )}
    >
      <User className="h-2.5 w-2.5" />
    </span>
  );
}

function LegacyJuliaBadge({
  whatsappNumber,
  codAgent,
  className,
}: {
  whatsappNumber?: string | null;
  codAgent?: string | null;
  className?: string;
}) {
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
        className,
      )}
    >
      {active ? 'J' : 'H'}
    </span>
  );
}

function Pill({
  active,
  Icon,
  title,
  className,
}: {
  active: boolean;
  Icon: typeof Bot;
  title: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center justify-center rounded h-4 w-4 shrink-0 border',
        active
          ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30'
          : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

// Backwards-compatible alias — preserves all existing imports across the app.
export const JuliaStatusBadge = ConversationStatusBadge;

export type JuliaStatusFilter = 'all' | 'active' | 'inactive';
