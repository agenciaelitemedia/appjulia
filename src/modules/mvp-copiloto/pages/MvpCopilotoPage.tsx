import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BridgeStatusCard } from '../components/BridgeStatusCard';
import { LeadPicker } from '../components/LeadPicker';
import { ContextPreview } from '../components/ContextPreview';
import { AnalysisResult } from '../components/AnalysisResult';
import { useCopilotBridge } from '../hooks/useCopilotBridge';
import { useMvpLeadContext } from '../hooks/useMvpLeadContext';
import { buildAnalysisPrompt } from '../lib/prompts';
import type { MvpLeadOption } from '../hooks/useMvpLeadSearch';

/**
 * MVP Copiloto Pro — valida a ponte com a conta ChatGPT Pro via extensão
 * de navegador: escolher lead, compilar histórico, analisar o atendimento.
 */
export default function MvpCopilotoPage() {
  const [term, setTerm] = useState('');
  const [lead, setLead] = useState<MvpLeadOption | null>(null);

  const bridge = useCopilotBridge();
  const { data: context, isLoading } = useMvpLeadContext(lead);

  const leadLabel = useMemo(() => lead?.name || lead?.phone || null, [lead]);

  const analyze = () => {
    if (!context?.text) return;
    bridge.ask(buildAnalysisPrompt(context.text));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          MVP Copiloto Pro
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prova de conceito: análise do atendimento usando a sua assinatura ChatGPT Pro, via extensão do navegador.
          Nada é gravado no sistema nesta etapa.
        </p>
      </div>

      <BridgeStatusCard
        state={bridge.state}
        version={bridge.version}
        session={bridge.session}
        onRecheck={bridge.check}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <LeadPicker
          term={term}
          onTermChange={setTerm}
          selected={lead}
          onSelect={(l) => {
            setLead(l);
            bridge.reset();
          }}
        />
        <ContextPreview
          lead={lead}
          context={context}
          isLoading={isLoading}
          canAnalyze={bridge.state === 'connected'}
          streaming={bridge.streaming}
          onAnalyze={analyze}
        />
        <AnalysisResult
          answer={bridge.answer}
          streaming={bridge.streaming}
          error={bridge.error}
          leadLabel={leadLabel}
        />
      </div>
    </div>
  );
}
