/**
 * Tela de consentimento OAuth do conector Copiloto.
 * Rota pública: /copiloto/consentimento?req=<request_id>
 * O usuário confirma a identidade Julia (e-mail + senha) e aprova o acesso.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import {
  approveConsent,
  denyConsent,
  fetchConsentRequest,
  type ConsentRequestInfo,
} from '@/modules/mvp-copiloto/lib/copilotoApi';

export default function CopilotoConsentPage() {
  const [params] = useSearchParams();
  const requestId = params.get('req') || '';

  const [info, setInfo] = useState<ConsentRequestInfo | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError('Pedido de autorização ausente.');
      return;
    }
    fetchConsentRequest(requestId)
      .then(setInfo)
      .catch((e) => setError((e as Error).message));
  }, [requestId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const url = approve ? await approveConsent(requestId, email, password) : await denyConsent(requestId);
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autorizar acesso à Julia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!info && !error && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido…
            </p>
          )}

          {info && (info.expired || info.already_used) && (
            <p className="text-sm text-destructive">
              Este pedido de autorização expirou. Volte ao aplicativo e tente conectar novamente.
            </p>
          )}

          {info && !info.expired && !info.already_used && (
            <>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{info.client_name}</strong> está pedindo acesso de leitura aos
                leads e conversas do seu escritório na Julia (escopo <code>{info.scope}</code>). Você pode revogar
                esse acesso quando quiser.
              </p>

              <div className="space-y-2">
                <Label htmlFor="cop-email">E-mail Julia</Label>
                <Input
                  id="cop-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cop-pass">Senha</Label>
                <Input
                  id="cop-pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={busy || !email || !password} onClick={() => decide(true)}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Autorizar
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Recusar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
