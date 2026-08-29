import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Download, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  answer: string;
  streaming: boolean;
  error: string | null;
  leadLabel: string | null;
}

export function AnalysisResult({ answer, streaming, error, leadLabel }: Props) {
  const download = () => {
    const blob = new Blob([answer], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analise-${(leadLabel || 'lead').replace(/\W+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex flex-col h-full min-h-0">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          3. Análise jurídica
          {streaming && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        {!!answer && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(answer);
                toast.success('Análise copiada');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={download}>
              <Download className="h-3.5 w-3.5" />
              .md
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <TriangleAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span className="text-destructive">{error}</span>
          </div>
        )}
        {!error && !answer && !streaming && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            A resposta da sua conta ChatGPT Pro aparece aqui em tempo real.
          </p>
        )}
        {!!answer && (
          <ScrollArea className="h-full max-h-[520px]">
            <div className="prose prose-sm dark:prose-invert max-w-none pr-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
