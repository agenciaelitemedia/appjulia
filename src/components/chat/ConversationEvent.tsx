import React from 'react';
import { ArrowRightLeft, CheckCircle2, XCircle, MessageSquare, RefreshCw, UserCheck, StickyNote, Flag, Pencil, Trophy } from 'lucide-react';
import { parseDbTimestamp } from '@/lib/dateUtils';
import type { ConversationHistoryEntry } from '@/types/conversation';
const ACTION_LABELS: Record<string, string> = {
  note_added: 'adicionou uma nota',
  note_updated: 'editou uma nota',
  note_deleted: 'removeu uma nota',
  priority_changed: 'alterou a prioridade',
  priority_updated: 'alterou a prioridade',
  tag_added: 'adicionou uma etiqueta',
  tag_removed: 'removeu uma etiqueta',
  updated: 'atualizou a conversa',
  created: 'criou a conversa',
  archived: 'arquivou a conversa',
  won: 'marcou como ganho',
  lost: 'marcou como perdido',
  moved: 'movimentou o card',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  note_added: <StickyNote className="h-3 w-3" />,
  note_updated: <Pencil className="h-3 w-3" />,
  note_deleted: <StickyNote className="h-3 w-3" />,
  priority_changed: <Flag className="h-3 w-3" />,
  priority_updated: <Flag className="h-3 w-3" />,
  won: <Trophy className="h-3 w-3" />,
  lost: <XCircle className="h-3 w-3" />,
};


interface ConversationEventProps {
  entry: ConversationHistoryEntry;
}

function isSystemActor(name?: string | null): boolean {
  if (!name) return true;
  const n = name.toLowerCase();
  return n === 'sistema' || n.includes('webhook') || n.includes('sistema');
}

function formatEventTimestamp(dateStr: string): string {
  const date = parseDbTimestamp(dateStr);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

interface RenderedConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
}

function getEventConfig(entry: ConversationHistoryEntry): RenderedConfig | null {
  const actor = entry.actor_name || 'Sistema';

  switch (entry.action) {
    case 'opened': {
      // Oculta evento "opened" gerado pelo webhook/sistema
      if (isSystemActor(entry.actor_name)) return null;
      return {
        icon: <MessageSquare className="h-3 w-3" />,
        label: `${actor} abriu a conversa`,
        color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      };
    }
    case 'closed':
      return {
        icon: <XCircle className="h-3 w-3" />,
        label: `${actor} encerrou a conversa`,
        color: 'text-muted-foreground bg-muted/50 border-border',
      };
    case 'resolved':
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: `${actor} resolveu a conversa`,
        color: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
      };
    case 'reopened':
      return {
        icon: <RefreshCw className="h-3 w-3" />,
        label: `${actor} reabriu a conversa`,
        color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      };
    case 'assigned': {
      const from = entry.from_value?.trim();
      const to = entry.to_value?.trim();
      const isAssumption = !from || from === to || from === actor;
      if (isAssumption) {
        return {
          icon: <UserCheck className="h-3 w-3" />,
          label: `${actor} assumiu a conversa`,
          color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
        };
      }
      return {
        icon: <ArrowRightLeft className="h-3 w-3" />,
        label: `${actor} transferiu para ${to || 'outro atendente'}`,
        color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      };
    }
    default:
      if (ACTION_LABELS[entry.action]) {
        return {
          icon: ACTION_ICONS[entry.action] ?? <MessageSquare className="h-3 w-3" />,
          label: `${actor} ${ACTION_LABELS[entry.action]}`,
          color: 'text-muted-foreground bg-muted/50 border-border',
        };
      }
      return {
        icon: <MessageSquare className="h-3 w-3" />,
        label: `${actor} ${entry.action}`,
        color: 'text-muted-foreground bg-muted/50 border-border',
      };
  }
}

export function ConversationEvent({ entry }: ConversationEventProps) {
  const config = getEventConfig(entry);
  if (!config) return null;

  return (
    <div className="flex justify-center px-4 py-1">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] ${config.color}`}>
        {config.icon}
        <span>{config.label}</span>
        <span className="opacity-60">{formatEventTimestamp(entry.created_at)}</span>
      </div>
    </div>
  );
}
