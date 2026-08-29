/**
 * Simulador local: executa as mesmas tools do conector MCP (buscar_lead,
 * obter_historico, analisar_atendimento) usando um token curto do próprio
 * usuário, para validar o conector antes de conectar o ChatGPT/Claude.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, TerminalSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../extend/auth';
import { mcpCall, requestSimulatorToken } from '../lib/copilotoApi';

const STORAGE_KEY = 'copiloto.sim.token';

export function McpSimulatorCard({ contactId }: { contactId: string | null }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const token = async () => {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) return cached;
    if (!password) throw new Error('Informe sua senha para gerar o token do simulador.');
    const fresh = await requestSimulatorToken(String(user?.email || ''), password);
    sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  };

  const run = async (tool: string) => {
    setBusy(tool);
    try {
      const t = await token();
      if (tool === 'tools/list') {
        const result = await mcpCall(t, 'tools/list');
        setOutput(JSON.stringify(result, null, 2));
      } else {
        if (!contactId) throw new Error('Selecione um lead primeiro.');
        const result = await mcpCall(t, 'tools/call', { name: tool, arguments: { contato_id: contactId } });
        setOutput(result?.content?.[0]?.text ?? JSON.stringify(result, null, 2));
      }
    } catch (e) {
      sessionStorage.removeItem(STORAGE_KEY);
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-primary" />
          Simulador do conector
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Input
          type="password"
          placeholder="Sua senha Julia (token de 15 min)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {['tools/list', 'obter_historico', 'analisar_atendimento'].map((tool) => (
            <Button key={tool} size="sm" variant="outline" disabled={!!busy} onClick={() => run(tool)}>
              {busy === tool && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {tool}
            </Button>
          ))}
        </div>
        {output && (
          <ScrollArea className="h-56 rounded-md border bg-muted/40 p-3">
            <pre className="text-xs whitespace-pre-wrap break-words">{output}</pre>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
