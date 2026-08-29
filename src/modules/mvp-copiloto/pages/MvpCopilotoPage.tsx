import { useMemo, useState } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { McpConnectionCard } from '../components/McpConnectionCard';
import { McpSimulatorCard } from '../components/McpSimulatorCard';
import { LeadPicker } from '../components/LeadPicker';
import { ContextPreview } from '../components/ContextPreview';
import { AnalysisResult } from '../components/AnalysisResult';
import { useMvpLeadContext } from '../hooks/useMvpLeadContext';
import { useCopilotoAnalysis } from '../hooks/useCopilotoAnalysis';
import { useAuth } from '../extend/auth';
import type { MvpLeadOption } from '../hooks/useMvpLeadSearch';
import { Input } from '@/components/ui/input';

/**
 * Copiloto Pro — caminho permitido pelas plataformas: conector MCP com OAuth
 * (ChatGPT/Claude) + análise interna pelo gateway oficial da Julia.
 */
export default function MvpCopilotoPage() {
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const [lead, setLead] = useState<MvpLeadOption | null>(null);
  const [password, setPassword] = useState('');

  const { data: context, isLoading } = useMvpLeadContext(lead);
  const analysis = useCopilotoAnalysis();

  const leadLabel = useMemo(() => lead?.name || lead?.phone || null, [lead]);

  const analyze = async () => {
    if (!lead?.contactId) return;
    try {
      await analysis.analyze(lead.contactId, String(user?.email || ''), password || undefined);
    } catch {
      /* precisa de senha — o campo já está visível */
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Copiloto Pro
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte o ChatGPT ou o Claude ao conector MCP da Julia, ou gere a análise aqui mesmo pelo gateway
          oficial. Nada é gravado no sistema nesta etapa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <McpConnectionCard />
        <McpSimulatorCard contactId={lead?.contactId ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LeadPicker
          term={term}
          onTermChange={setTerm}
          selected={lead}
          onSelect={(l) => {
            setLead(l);
            analysis.reset();
          }}
        />
        <div className="space-y-3">
          <ContextPreview
            lead={lead}
            context={context}
            isLoading={isLoading}
            canAnalyze={!!lead?.contactId}
            streaming={analysis.streaming}
            onAnalyze={analyze}
          />
          {!analysis.hasToken() && (
            <Input
              type="password"
              placeholder="Sua senha Julia (autoriza a análise por 15 min)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </div>
        <AnalysisResult
          answer={analysis.answer}
          streaming={analysis.streaming}
          error={analysis.error}
          leadLabel={leadLabel}
        />
      </div>
    </div>
  );
}
