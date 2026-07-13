import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Sparkles, Clock, MessageSquare, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useConversationSummaries } from '@/hooks/useConversationSummaries';
import { cn } from '@/lib/utils';

interface ConversationSummariesProps {
  conversationId?: string | null;
  contactId: string;
}

export function ConversationSummaries({ conversationId, contactId }: ConversationSummariesProps) {
  const { summaries, isLoading, generateSummary, getAfterTsForNext } = useConversationSummaries(conversationId, contactId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const buildPreview = (text: string) => {
    if (!text) return '';
    const firstLines = text.split('\n').slice(0, 2).join(' ').trim();
    const clipped = firstLines.length > 180 ? firstLines.slice(0, 180).trimEnd() + '…' : firstLines;
    return clipped;
  };

  const handleGenerate = async () => {
    if (!conversationId) {
      toast.error('Selecione uma conversa para gerar um novo resumo');
      return;
    }
    setIsGenerating(true);
    try {
      await generateSummary(conversationId, contactId, getAfterTsForNext(), 'manual');
      toast.success('Resumo gerado com sucesso');
    } catch {
      toast.error('Erro ao gerar resumo');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTs = (ts: string | null) => {
    if (!ts) return '—';
    return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {summaries.length === 0
            ? 'Nenhum resumo gerado ainda'
            : `${summaries.length} resumo${summaries.length !== 1 ? 's' : ''}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={isGenerating || !conversationId}
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {summaries.length === 0 ? 'Gerar Resumo' : 'Novo Resumo'}
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && summaries.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {conversationId
              ? 'Clique em "Gerar Resumo" para criar um resumo desta conversa com IA'
              : 'Nenhum resumo encontrado para este contato'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {summaries.map((s) => {
          const isOpen = !!expanded[s.id];
          return (
          <div key={s.id} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className="w-full flex items-center gap-3 px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground hover:bg-muted transition-colors text-left"
            >
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {buildPreview(s.summary)}
                </p>
              </div>
            ) : (
            <div className="p-4 space-y-3">
              {/* Período */}
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground">Período:</span>
                <span>{formatTs(s.first_message_ts)}</span>
                <span>→</span>
                <span>{formatTs(s.last_message_ts)}</span>
              </div>

              {/* Sentiment */}
              {s.sentiment && (
                <div className="text-sm">
                  <span className="font-medium text-foreground">Sentimento:</span>{' '}
                  <span className="text-muted-foreground">{s.sentiment}</span>
                </div>
              )}

              {/* Summary */}
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Resumo:</p>
                <div className="text-muted-foreground space-y-0.5 whitespace-pre-line">
                  {s.summary}
                </div>
              </div>

              {/* Atendimento */}
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
        })}
      </div>
    </div>
  );
}
