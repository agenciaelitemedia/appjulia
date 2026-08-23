import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MessageSquare, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/hooks/useConversationSummaries';

const buildPreview = (text: string) => {
  if (!text) return '';
  const firstLines = text.split('\n').slice(0, 2).join(' ').trim();
  return firstLines.length > 180 ? firstLines.slice(0, 180).trimEnd() + '…' : firstLines;
};

const formatTs = (ts: string | null) => {
  if (!ts) return '—';
  return format(new Date(ts), 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

interface SummaryCardProps {
  summary: ConversationSummary;
  defaultOpen?: boolean;
  className?: string;
  title?: string;
}

/**
 * Card colapsável de resumo de atendimento.
 * Usado tanto na aba "Resumos" do painel de detalhes quanto na
 * linha do tempo da conversa.
 */
export function SummaryCard({ summary: s, defaultOpen = false, className, title }: SummaryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground hover:bg-muted transition-colors text-left"
      >
        {title && <span className="font-medium text-foreground">{title}</span>}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {s.message_count} mensagens
        </span>
        {s.triggered_by && s.triggered_by.startsWith('auto') && (
          <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4 gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            {s.triggered_by === 'auto_resolve'
              ? 'auto (resolvida)'
              : s.triggered_by === 'auto_close'
              ? 'auto (encerrada)'
              : 'automático'}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {!isOpen ? (
        <div className="px-4 py-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{buildPreview(s.summary)}</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span className="font-medium text-foreground">Período:</span>
            <span>{formatTs(s.first_message_ts)}</span>
            <span>→</span>
            <span>{formatTs(s.last_message_ts)}</span>
          </div>

          {s.sentiment && (
            <div className="text-sm">
              <span className="font-medium text-foreground">Sentimento:</span>{' '}
              <span className="text-muted-foreground">{s.sentiment}</span>
            </div>
          )}

          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Resumo:</p>
            <div className="text-muted-foreground space-y-0.5 whitespace-pre-line">{s.summary}</div>
          </div>

          {s.atendimento && (
            <div className="text-sm">
              <span className="font-medium text-foreground">Atendimento:</span>{' '}
              <span className="text-muted-foreground">{s.atendimento}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}