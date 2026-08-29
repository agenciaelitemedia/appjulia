import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, PlugZap, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { BridgeState } from '../hooks/useCopilotBridge';
import type { BridgeSessionInfo } from '../lib/bridgeProtocol';

const EXTENSION_ZIP = '/julia-companion-extension.zip';

/** Download via fetch+blob: link direto falha no preview autenticado. */
async function downloadExtension() {
  try {
    const res = await fetch(EXTENSION_ZIP);
    if (!res.ok) throw new Error(`Falha ao baixar (${res.status})`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'julia-companion-extension.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e: any) {
    toast.error(e?.message || 'Não foi possível baixar a extensão.');
  }
}


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
                  ? `${session?.email || 'conta conectada'}${session?.plan ? ` · plano ${session.plan}` : ''} · mantenha uma aba do chatgpt.com aberta`
                  : 'A extensão usa a sua própria sessão do navegador — nenhum token é salvo no sistema.'}
              </p>

            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {version && <Badge variant="secondary">extensão v{version}</Badge>}
            <Button size="sm" variant="outline" onClick={downloadExtension} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Baixar extensão (.zip)
            </Button>
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
            <p>1. Clique em <strong>Baixar extensão (.zip)</strong> acima e descompacte o arquivo.</p>
            <p>2. No Chrome ou Edge, abra <code>chrome://extensions</code> e ative o Modo do desenvolvedor.</p>
            <p>3. Clique em "Carregar sem compactação" e selecione a pasta descompactada.</p>
            <p>4. Faça login em <code>chatgpt.com</code>, deixe uma aba dele aberta e recarregue esta página.</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
