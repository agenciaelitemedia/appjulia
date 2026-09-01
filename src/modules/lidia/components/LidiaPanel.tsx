import { Sparkles, Loader2, AlertCircle, CheckCircle2, Circle, RefreshCw, Lightbulb, MessageSquare, Phone, ShieldAlert, Send } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, ScrollArea,
  Skeleton, Separator, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Collapsible, CollapsibleContent, CollapsibleTrigger, cn, MascoteLoader,
} from '../extend/ui';
import { useLidia, type LidiaOutput, type LidiaQuestion, type LidiaMessage, type LidiaUnavailable } from '../hooks/useLidia';

interface LidiaPanelProps {
  conversationId: string;
  clientId: string;
  userEmail: string;
  contactName?: string | null;
}

export function LidiaPanel({ conversationId, clientId, userEmail, contactName }: LidiaPanelProps) {
  const { latest, latestLoading, messages, analyze, analyzeLoading, analyzeError, unavailable, diagnostics, chat, chatLoading } = useLidia({
    clientId,
    conversationId,
    userEmail,
    enabled: true,
  });

  useEffect(() => {
    if (!latest && !latestLoading) {
      analyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, clientId]);

  const analysis = latest?.last_analysis ?? null;

  if (latestLoading && !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <MascoteLoader size="md" />
        <p className="text-sm">A LÍDIA está analisando a conversa...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">
          {unavailable?.message ?? (analyzeError instanceof Error
            ? analyzeError.message
            : 'Não foi possível carregar a análise da LÍDIA.')}
        </p>
        {unavailable ? (
          <LidiaAvailabilityAction unavailable={unavailable} onCheck={() => analyze()} loading={analyzeLoading} />
        ) : (
          <Button size="sm" onClick={() => analyze()} disabled={analyzeLoading}>
            {analyzeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <LidiaPhaseHeader output={analysis} contactName={contactName} />
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-3">
          {unavailable && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-2">
                  <p>{unavailable.message}</p>
                  <p className="text-xs text-muted-foreground">A análise anterior permanece disponível abaixo.</p>
                  <LidiaAvailabilityAction unavailable={unavailable} onCheck={() => analyze()} loading={analyzeLoading} />
                </div>
              </div>
            </div>
          )}
          <LidiaNextStepCard output={analysis} loading={analyzeLoading} onRefresh={() => analyze()} />
          <LidiaSuggestionsCard output={analysis} />

          <LidiaLegalAnalysisCard output={analysis} />
          <LidiaCallScriptCard output={analysis} />
          <LidiaChatThread messages={messages} onSend={chat} loading={chatLoading} />
        </div>
      </ScrollArea>
    </div>
  );
}

function LidiaAvailabilityAction({ unavailable, onCheck, loading }: { unavailable: LidiaUnavailable; onCheck: () => void; loading: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {unavailable.requires === 'top_up'
          ? 'Um responsável precisa adicionar créditos ao workspace para liberar novas análises.'
          : 'Um administrador precisa liberar o uso da IA no workspace.'}
      </p>
      <Button size="sm" variant="outline" onClick={onCheck} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Verificar novamente
      </Button>
    </div>
  );
}

function LidiaPhaseHeader({ output, contactName }: { output: LidiaOutput; contactName?: string | null }) {
  const phaseLabel: Record<string, string> = {
    abertura: 'Abertura',
    diagnostico: 'Diagnóstico',
    analise_juridica: 'Análise jurídica',
    proposta: 'Proposta/Valor',
    objecoes: 'Objeções',
    fechamento: 'Fechamento',
    pos_assinatura: 'Pós-assinatura',
  };
  const phase = phaseLabel[output.phase] || output.phase;

  return (
    <div className="p-3 border-b bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">LÍDIA — Copiloto de vendas</p>
            <p className="text-xs text-muted-foreground">Fase: {phase}</p>
          </div>
        </div>
        <ConfidenceBadge confidence={output.confidence} />
      </div>
      {contactName && (
        <p className="mt-2 text-xs text-muted-foreground">
          Conduzindo o atendimento com <span className="font-medium text-foreground">{contactName}</span>.
        </p>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) return <Badge variant="outline" className="text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Alta</Badge>;
  if (confidence >= 0.5) return <Badge variant="outline" className="text-amber-600 border-amber-200"><Circle className="h-3 w-3 mr-1" />Média</Badge>;
  return <Badge variant="outline" className="text-rose-600 border-rose-200"><AlertCircle className="h-3 w-3 mr-1" />Incompleta</Badge>;
}

function LidiaNextStepCard({ output, loading, onRefresh }: { output: LidiaOutput; loading: boolean; onRefresh: () => void }) {
  return (
    <Card className="border-l-4 border-l-amber-400">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Próximo passo
          </CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={loading} title="Atualizar análise">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{output.next_step}</p>
        {output.incomplete_info.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Ainda falta confirmar:</p>
            <ul className="space-y-1">
              {output.incomplete_info.map((info, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Circle className="h-3 w-3 mt-0.5 text-amber-500" />
                  {info}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LidiaSuggestionsCard({ output }: { output: LidiaOutput }) {
  if (!output.questions.length && !output.suggested_reply?.text) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          Sugestões para o atendente
        </CardTitle>
        <CardDescription className="text-xs">Toque em um texto para copiar. Envie apenas quando fizer sentido.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {output.suggested_reply?.text && (
          <CopyableText label="Resposta pronta" sub={output.suggested_reply.when_to_use} text={output.suggested_reply.text} />
        )}
        {output.questions.map((q, i) => (
          <QuestionItem key={i} q={q} index={i} />
        ))}
      </CardContent>
    </Card>
  );
}

function QuestionItem({ q, index }: { q: LidiaQuestion; index: number }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group cursor-pointer rounded-md border p-2 hover:bg-muted/50 transition-colors" onClick={() => copyToClipboard(q.text)}>
            <p className="text-xs font-medium text-muted-foreground mb-1">Pergunta {index + 1}</p>
            <p className="text-sm">{q.text}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium">Por que perguntar isso:</p>
          <p className="text-xs text-muted-foreground">{q.why}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CopyableText({ label, sub, text }: { label: string; sub?: string; text: string }) {
  return (
    <div className="rounded-md border p-2 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => copyToClipboard(text)}>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}{sub ? ` · ${sub}` : ''}</p>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function LidiaLegalAnalysisCard({ output }: { output: LidiaOutput }) {
  const { legal_analysis } = output;
  const strengthMap: Record<string, string> = {
    forte: 'Caso forte',
    medio: 'Caso médio',
    fraco: 'Caso fraco',
    inconclusivo: 'Inconclusivo — faltam dados',
  };
  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-indigo-500" />
                Análise jurídica simplificada
              </CardTitle>
              <Badge variant={legal_analysis.strength === 'forte' ? 'default' : 'secondary'} className="text-xs">
                {strengthMap[legal_analysis.strength] || legal_analysis.strength}
              </Badge>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <p className="text-sm">{legal_analysis.summary}</p>
            {legal_analysis.evidence_needed.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Documentos/evidências a solicitar:</p>
                <ul className="space-y-1">
                  {legal_analysis.evidence_needed.map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <Circle className="h-3 w-3 mt-0.5 text-indigo-500" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {legal_analysis.risks.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Riscos:</p>
                <ul className="space-y-1">
                  {legal_analysis.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <Circle className="h-3 w-3 mt-0.5 text-rose-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LidiaCallScriptCard({ output }: { output: LidiaOutput }) {
  const { objection, call } = output;
  if (!objection.detected && !call.recommended) return null;

  return (
    <Card className="border-l-4 border-l-rose-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-rose-500" />
          {call.recommended ? 'Hora de ligar' : 'Objeção detectada'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {objection.detected && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/20 p-2">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Objeção: {objection.type}</p>
            <p className="text-xs text-muted-foreground mt-1">Técnica: {objection.technique}</p>
            <CopyableText label="Resposta sugerida" text={objection.reply} />
          </div>
        )}
        {call.recommended && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{call.reason}</p>
            {call.script.map((s, i) => (
              <div key={i} className="mb-2">
                <p className="text-xs font-medium text-muted-foreground capitalize">{s.step.replace(/_/g, ' ')}</p>
                <CopyableText label="Fala" text={s.text} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LidiaChatThread({ messages, onSend, loading }: { messages: LidiaMessage[]; onSend: (q: string) => void; loading: boolean }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Pergunte à LÍDIA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="max-h-48 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground italic">A LÍDIA responde aqui quando você precisar de ajuda.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn('text-xs rounded-md p-2', m.role === 'user' ? 'bg-muted ml-6' : 'bg-violet-50 dark:bg-violet-950/20 mr-6')}>
              <p className="font-medium mb-0.5">{m.role === 'user' ? 'Você' : 'LÍDIA'}</p>
              <p className="text-muted-foreground">{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              LÍDIA está pensando...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <Separator />
        <div className="flex gap-2">
          <input
            className="flex-1 min-w-0 rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Ex.: o que fazer se o cliente disser que é caro?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                onSend(input.trim());
                setInput('');
              }
            }}
          />
          <Button
            size="icon"
            className="h-8 w-8"
            disabled={!input.trim() || loading}
            onClick={() => {
              if (input.trim()) {
                onSend(input.trim());
                setInput('');
              }
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LidiaPanelSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
