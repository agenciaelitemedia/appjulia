import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, FileText, MessageSquareQuote, Activity, Copy, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  conversationId: string;
  onInsertReply?: (text: string) => void;
}

type Mode = 'summary' | 'suggest' | 'sentiment';

export function AIAssistPanel({ conversationId, onInsertReply }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Mode | null>(null);
  const [result, setResult] = useState<{ mode: Mode; text: string } | null>(null);

  const run = async (mode: Mode) => {
    setLoading(mode);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('chat-ai-assist', {
      body: { conversation_id: conversationId, mode },
    });
    setLoading(null);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao consultar IA');
      return;
    }
    setResult({ mode, text: data.result });
  };

  const titleByMode: Record<Mode, string> = {
    summary: 'Resumo da conversa',
    suggest: 'Resposta sugerida',
    sentiment: 'Sentimento do cliente',
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        IA
      </Button>
    );
  }

  return (
    <Card className="absolute right-4 top-16 z-30 w-80 p-3 shadow-lg space-y-2 bg-background border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> Assistente IA
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run('summary')} className="flex-col h-auto py-2 gap-1">
          <FileText className="h-3.5 w-3.5" />
          <span className="text-[10px]">Resumo</span>
        </Button>
        <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run('suggest')} className="flex-col h-auto py-2 gap-1">
          <MessageSquareQuote className="h-3.5 w-3.5" />
          <span className="text-[10px]">Sugerir</span>
        </Button>
        <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run('sentiment')} className="flex-col h-auto py-2 gap-1">
          <Activity className="h-3.5 w-3.5" />
          <span className="text-[10px]">Sentimento</span>
        </Button>
      </div>
      {loading && <p className="text-xs text-muted-foreground animate-pulse">Analisando conversa...</p>}
      {result && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">{titleByMode[result.mode]}</p>
          <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded p-2 max-h-48 overflow-y-auto">{result.text}</div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(result.text); toast.success('Copiado'); }}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
            {result.mode === 'suggest' && onInsertReply && (
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => { onInsertReply(result.text); setOpen(false); }}>
                Usar
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
