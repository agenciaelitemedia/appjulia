import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sparkles, Clock, MessageSquare, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ConversationSummary } from '@/hooks/useConversationSummaries';

interface InlineSummaryCardProps {
  summary: ConversationSummary;
}

export function InlineSummaryCard({ summary: s }: InlineSummaryCardProps) {
  const [open, setOpen] = useState(false);

  const preview = (() => {
    if (!s.summary) return '';
    const firstLines = s.summary.split('\n').slice(0, 2).join(' ').trim();
    return firstLines.length > 180 ? firstLines.slice(0, 180).trimEnd() + '…' : firstLines;
  })();

  const formatTs = (ts: string | null) => {
    if (!ts) return '—';
    return format(new Date(ts), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const isAuto = s.triggered_by && s.triggered_by.startsWith('auto');

  return (
    <div className="flex justify-center px-4 py-2">
      <div className="w-full max-w-2xl rounded-lg border border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-primary/10 transition-colors text-left"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">Resumo da conversa</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {s.message_count}
          </span>
          {isAuto && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 gap-0.5">
              <Zap className="h-2.5 w-2.5" />
              {s.triggered_by === 'auto_resolve'
                ? 'auto (resolvida)'
                : s.triggered_by === 'auto_close'
                ? 'auto (encerrada)'
                : 'automático'}
            </Badge>
          )}
          <span className="ml-auto">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        {!open ? (
          <div className="px-3 py-2 border-t border-primary/10">
            <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-primary/10 space-y-2">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span className="font-medium text-foreground">Período:</span>
              <span>{formatTs(s.first_message_ts)}</span>
              <span>→</span>
              <span>{formatTs(s.last_message_ts)}</span>
            </div>
            {s.sentiment && (
              <div className="text-xs">
                <span className="font-medium text-foreground">Sentimento:</span>{' '}
                <span className="text-muted-foreground">{s.sentiment}</span>
              </div>
            )}
            <div className="text-xs">
              <p className="font-medium text-foreground mb-0.5">Resumo:</p>
              <div className="text-muted-foreground whitespace-pre-line">{s.summary}</div>
            </div>
            {s.atendimento && (
              <div className="text-xs">
                <span className="font-medium text-foreground">Atendimento:</span>{' '}
                <span className="text-muted-foreground">{s.atendimento}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}