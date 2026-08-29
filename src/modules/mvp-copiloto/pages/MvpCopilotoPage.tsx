import { useState } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { McpConnectionCard } from '../components/McpConnectionCard';
import { McpSimulatorCard } from '../components/McpSimulatorCard';
import { LeadPicker } from '../components/LeadPicker';
import type { MvpLeadOption } from '../hooks/useMvpLeadSearch';

/**
 * Copiloto Pro — a Julia expõe um conector MCP (OAuth 2.1 + PKCE) e a análise
 * é feita pelo cliente conectado (OpenClaw, ChatGPT ou Claude), com a conta Pro
 * do próprio usuário. Nenhuma IA interna é usada aqui.
 */
export default function MvpCopilotoPage() {
  const [term, setTerm] = useState('');
  const [lead, setLead] = useState<MvpLeadOption | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Copiloto Pro — conector MCP
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte o OpenClaw (ou ChatGPT/Claude) ao seu escritório na Julia e peça as análises jurídicas por lá,
          usando sua própria assinatura Pro.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            Como conectar no OpenClaw
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
            <li>
              Copie a <strong>URL do conector</strong> no cartão abaixo.
            </li>
            <li>
              No OpenClaw, adicione um <strong>servidor MCP remoto</strong> (HTTP) e cole essa URL. Ele detecta
              sozinho que o servidor exige OAuth.
            </li>
            <li>
              O navegador abre a <strong>tela de login da Julia</strong>; entre com o e-mail e senha do escritório
              que deve ser acessado.
            </li>
            <li>
              Na tela de consentimento, confira o aplicativo solicitante e o escopo <code>leads:read</code> e
              clique em <strong>Autorizar</strong>.
            </li>
            <li>
              De volta ao OpenClaw, as ferramentas aparecem: <code>buscar_lead</code>,{' '}
              <code>obter_historico</code> e <code>analisar_atendimento</code>.
            </li>
            <li>
              Peça no chat, por exemplo: <em>"busque o lead 5519982045075 na Julia e faça a análise jurídica do
              atendimento"</em>.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            🔒 O acesso fica restrito a <strong>uma única conta/escritório</strong>: o escritório é resolvido no
            servidor a partir do login que você fez e gravado no token — as ferramentas ignoram qualquer
            identificador enviado pelo cliente. O escopo é somente leitura, nenhum cookie ou senha vai para o
            OpenClaw, e você revoga a conexão a qualquer momento no cartão ao lado.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <McpConnectionCard />
        <McpSimulatorCard contactId={lead?.contactId ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadPicker term={term} onTermChange={setTerm} selected={lead} onSelect={setLead} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead selecionado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {!lead ? (
              <p className="text-muted-foreground">
                Selecione um lead para copiar o <code>contato_id</code> e testar as ferramentas.
              </p>
            ) : (
              <>
                <p className="font-medium">{lead.name || lead.phone || 'Lead'}</p>
                <p className="text-muted-foreground">{lead.phone}</p>
                <p className="text-xs font-mono break-all text-muted-foreground">contato_id: {lead.contactId}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
