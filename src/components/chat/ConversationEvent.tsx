import React from 'react';
import { ArrowRightLeft, CheckCircle2, XCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationHistoryEntry } from '@/types/conversation';

interface ConversationEventProps {
  entry: ConversationHistoryEntry;
}

const actionConfig: Record<string, { icon: React.ReactNode; label: (e: ConversationHistoryEntry) => string; color: string }> = {
  opened: {
    icon: <MessageSquare className="h-3 w-3" />,
    label: (e) => `${e.actor_name || 'Sistema'} abriu a conversa`,
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  },
  closed: {
    icon: <XCircle className="h-3 w-3" />,
    label: (e) => `${e.actor_name || 'Sistema'} encerrou a conversa`,
    color: 'text-muted-foreground bg-muted/50 border-border',
  },
  resolved: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: (e) => `${e.actor_name || 'Sistema'} resolveu a conversa`,
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  },
  reopened: {
    icon: <RefreshCw className="h-3 w-3" />,
    label: (e) => `${e.actor_name || 'Sistema'} reabriu a conversa`,
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  assigned: {
    icon: <ArrowRightLeft className="h-3 w-3" />,
    label: (e) => `${e.actor_name || 'Sistema'} transferiu para ${e.to_value || 'outro atendente'}`,
    color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
  },
};

export function ConversationEvent({ entry }: ConversationEventProps) {
  const config = actionConfig[entry.action] || actionConfig.opened;

  return (
    <div className="flex justify-center px-4 py-1">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] ${config.color}`}>
        {config.icon}
        <span>{config.label(entry)}</span>
        <span className="opacity-60">
          {format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
      </div>
      {entry.notes && (
        <span className="text-[10px] text-muted-foreground italic ml-2 self-center">
          {entry.notes}
        </span>
      )}
    </div>
  );
}
