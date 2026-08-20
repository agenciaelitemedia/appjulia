import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useConversationSummaries } from '@/hooks/useConversationSummaries';
import { SummaryCard } from './SummaryCard';

interface ConversationSummariesProps {
  conversationId?: string | null;
  contactId: string;
}

export function ConversationSummaries({ conversationId, contactId }: ConversationSummariesProps) {
  const { summaries, isLoading, generateSummary, getAfterTsForNext } = useConversationSummaries(conversationId, contactId);
  const [isGenerating, setIsGenerating] = useState(false);

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
        {summaries.map((s) => (
          <SummaryCard key={s.id} summary={s} />
        ))}
      </div>
    </div>
  );
}
