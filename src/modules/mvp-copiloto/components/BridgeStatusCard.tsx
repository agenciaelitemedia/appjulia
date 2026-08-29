import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlugZap, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { BridgeState } from '../hooks/useCopilotBridge';
import type { BridgeSessionInfo } from '../lib/bridgeProtocol';

interface Props {
  state: BridgeState;
  version: string | null;
  session: BridgeSessionInfo | null;
  onRecheck: () => void;
}

export function BridgeStatusCard({ state, version, session, onRecheck }: Props) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {state === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {state === 'missing' && <TriangleAlert className="h-5 w-5 text-amber-500" />}
            {state === 'logged_out' && <PlugZap className="h-5 w-5 text-orange-500" />}
            {state === 'connected' && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
            <div>
              <p className="font-semibold text-sm">
                {state === 'checking' && 'Verificando a extensão Julia Companion...'}
                {state === 'missing' && 'Extensão não detectada'}
                {state === 'logged_out' && 'Extensão ativa, mas sem sessão do ChatGPT'}
                {state === 'connected' && 'ChatGPT Pro conectado'}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === 'connected'
                  ? `${session?.email || 'conta conectada'}${session?.plan ? ` · plano ${session.plan}` : ''}`
                  : 'A extensão usa a sua própria sessão do navegador — nenhum token é salvo no sistema.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {version && <Badge variant="secondary">extensão v{version}</Badge>}
            <Button size="sm" variant="outline" onClick={onRecheck} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Verificar
            </Button>
            {state === 'logged_out' && (
              <Button
                size="sm"
                onClick={() => window.open('https://chatgpt.com', '_blank', 'noopener')}
                className="gap-1.5"
              >
                <PlugZap className="h-3.5 w-3.5" />
                Conectar ChatGPT Pro
              </Button>
            )}
          </div>
        </div>

        {state === 'missing' && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como instalar a extensão (MVP)</p>
            <p>1. Baixe/copie a pasta <code>src/modules/mvp-copiloto/extension</code> do projeto.</p>
            <p>2. No Chrome ou Edge, abra <code>chrome://extensions</code> e ative o Modo do desenvolvedor.</p>
            <p>3. Clique em "Carregar sem compactação" e selecione essa pasta.</p>
            <p>4. Faça login em <code>chatgpt.com</code> e recarregue esta página.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
