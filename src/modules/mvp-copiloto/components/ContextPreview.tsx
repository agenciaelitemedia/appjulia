import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';
import type { CompiledContext } from '../lib/buildLeadContext';
import type { MvpLeadOption } from '../hooks/useMvpLeadSearch';

interface Props {
  lead: MvpLeadOption | null;
  context: CompiledContext | undefined;
  isLoading: boolean;
  canAnalyze: boolean;
  streaming: boolean;
  onAnalyze: () => void;
}

export function ContextPreview({ lead, context, isLoading, canAnalyze, streaming, onAnalyze }: Props) {
  return (
    <Card className="flex flex-col h-full min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">2. Contexto compilado</CardTitle>
        {!lead && <p className="text-xs text-muted-foreground">Selecione um lead para ver o histórico.</p>}
        {lead && context && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{context.messageCount} mensagens</Badge>
            {context.attachments.length > 0 && (
              <Badge variant="secondary">{context.attachments.length} arquivos citados</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!isLoading && context && (
          <ScrollArea className="flex-1 min-h-0 max-h-[340px] rounded-md border bg-muted/30">
            <pre className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono">{context.text}</pre>
          </ScrollArea>
        )}
        <Button
          onClick={onAnalyze}
          disabled={!canAnalyze || streaming || !context?.messageCount}
          className="gap-2 w-full"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Analisar atendimento com ChatGPT Pro
        </Button>
        {!canAnalyze && lead && (
          <p className="text-xs text-muted-foreground text-center">
            Conecte a extensão e a sua conta ChatGPT Pro para liberar a análise.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
