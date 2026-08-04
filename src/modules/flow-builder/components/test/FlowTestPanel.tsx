import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Loader2,
  Play,
  SkipForward,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useFlowSimulation } from '../../hooks/useFlowSimulation';

interface FlowTestPanelProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe o bloco em foco para destacar no canvas. */
  onHighlightNode?: (nodeId: string | null) => void;
}

const STATUS_ICON = {
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  skipped: <CircleSlash className="h-4 w-4 text-muted-foreground" />,
  error: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

export function FlowTestPanel({ flowId, open, onOpenChange, onHighlightNode }: FlowTestPanelProps) {
  const [messageText, setMessageText] = useState('Olá, quero saber sobre meu processo');
  const [messageType, setMessageType] = useState('text');
  const [step, setStep] = useState(0);
  const { run, reset, isRunning, result, error } = useFlowSimulation();
  const logs = result?.logs ?? [];
  const currentLog = logs[step];

  // Sincroniza o destaque no canvas com o passo atual da trilha.
  useEffect(() => {
    onHighlightNode?.(open && currentLog ? currentLog.node_id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLog?.node_id, open]);

  useEffect(() => {
    setStep(0);
  }, [result]);

  const variables = (currentLog?.variables ?? {}) as Record<string, unknown>;
  const variableEntries = Object.entries(variables);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          setStep(0);
          onHighlightNode?.(null);
        }
        onOpenChange(v);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-lg">
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

            {logs.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">
                    Passo {step + 1} de {logs.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                      title="Passo anterior"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setStep((s) => Math.min(logs.length - 1, s + 1))}
                      disabled={step >= logs.length - 1}
                      title="Próximo passo"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setStep(logs.length - 1)}
                      disabled={step >= logs.length - 1}
                      title="Ir para o último passo"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {currentLog && (
                  <div className="mt-2 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {STATUS_ICON[currentLog.status]} {currentLog.label || currentLog.kind}
                    </p>
                    {currentLog.detail && (
                      <p className="text-xs text-muted-foreground">{currentLog.detail}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {currentLog.branch && (
                        <Badge variant="secondary" className="h-5 text-[10px]">saída: {currentLog.branch}</Badge>
                      )}
                      {currentLog.duration_ms != null && (
                        <Badge variant="outline" className="h-5 text-[10px]">{currentLog.duration_ms}ms</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 rounded-md bg-background px-2 py-1.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        Variáveis neste passo
                      </p>
                      {variableEntries.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">Nenhuma variável definida.</p>
                      ) : (
                        variableEntries.map(([key, value]) => (
                          <p key={key} className="truncate text-[11px]">
                            <span className="font-medium">{key}</span>
                            <span className="text-muted-foreground">: {String(value ?? '')}</span>
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              <ol className="divide-y">
                {result.logs.map((log, index) => (
                  <li
                    key={`${log.node_id}-${index}`}
                    role="button"
                    onClick={() => setStep(index)}
                    className={cn(
                      'flex cursor-pointer gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50',
                      index === step && 'bg-primary/10',
                    )}
                  >
                    <span className="mt-0.5">{STATUS_ICON[log.status]}</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                        {log.label}
                      </p>
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