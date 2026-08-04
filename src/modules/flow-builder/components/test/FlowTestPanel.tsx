import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, Play } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFlowSimulation } from '../../hooks/useFlowSimulation';

interface FlowTestPanelProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_ICON = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  skipped: <CircleSlash className="h-4 w-4 text-muted-foreground" />,
  error: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

export function FlowTestPanel({ flowId, open, onOpenChange }: FlowTestPanelProps) {
  const [messageText, setMessageText] = useState('Olá, quero saber sobre meu processo');
  const [messageType, setMessageType] = useState('text');
  const { run, reset, isRunning, result, error } = useFlowSimulation();

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Testar automação</SheetTitle>
          <SheetDescription>
            A simulação percorre os blocos e mostra o que aconteceria. Nenhuma mensagem é enviada e nada é
            alterado nas conversas.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-type" className="text-xs">Tipo da mensagem recebida</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger id="test-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="audio">Áudio</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-text" className="text-xs">Texto simulado do lead</Label>
            <Textarea
              id="test-text"
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escreva a mensagem que o lead enviaria"
            />
          </div>

          <Button
            className="w-full rounded-full"
            disabled={isRunning}
            onClick={() => run({ flowId, messageText, messageType })}
          >
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Executar simulação
          </Button>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        {result && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  result.status === 'completed'
                    ? 'border-emerald-500/40 text-emerald-600'
                    : 'border-destructive/40 text-destructive'
                }
              >
                {result.status === 'completed' ? 'Concluído' : 'Falhou'}
              </Badge>
              <span className="text-xs text-muted-foreground">{result.logs.length} passo(s)</span>
            </div>

            {result.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{result.error}</p>
            )}

            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              <ol className="divide-y">
                {result.logs.map((log, index) => (
                  <li key={`${log.node_id}-${index}`} className="flex gap-3 px-3 py-2.5">
                    <span className="mt-0.5">{STATUS_ICON[log.status]}</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">{log.label}</p>
                      {log.detail && (
                        <p className="text-xs text-muted-foreground">{log.detail}</p>
                      )}
                      {log.branch && log.branch !== 'out' && (
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          saída: {log.branch}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}