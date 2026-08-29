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
          Análise jurídica de atendimentos com sua conta Pro — pelo caminho oficial das plataformas.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            O que preciso fazer? — 2 caminhos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 text-sm">
          <div className="space-y-2">
            <p className="font-semibold">Caminho 1 — Analisar aqui mesmo (mais rápido)</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Em <strong>Lead</strong> (abaixo), busque e selecione o lead pelo nome ou telefone.</li>
              <li>Confira a prévia do histórico que será enviado à IA.</li>
              <li>Na primeira análise, informe sua <strong>senha da Julia</strong> (autoriza por 15 min).</li>
              <li>Clique em <strong>Analisar atendimento</strong> e acompanhe o resumo jurídico ao lado.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Caminho 2 — Usar dentro do ChatGPT/Claude (sua conta Pro)</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Copie a <strong>URL do conector</strong> no cartão "Conector oficial (MCP)".</li>
              <li>No ChatGPT: <em>Settings → Connectors → Developer mode → Add</em> (ou Claude: <em>Settings → Connectors → Add custom</em>).</li>
              <li>Cole a URL e conecte — você fará <strong>login na Julia</strong> e aprovará o acesso de leitura.</li>
              <li>Pronto: peça no chat, ex.: <em>"analise o atendimento do lead 55119... com a Julia"</em>.</li>
              <li>Para desconectar depois, revogue a conexão no cartão do conector (exige sua senha).</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            🔒 Seguro e permitido: nenhum cookie/sessão de terceiros é usado; a autorização é OAuth com PKCE,
            por escritório, e pode ser revogada a qualquer momento. Nada é gravado no sistema nesta etapa.
          </p>
        </CardContent>
      </Card>

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
