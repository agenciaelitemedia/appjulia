/**
 * Rota /authorize no domínio da Julia.
 *
 * Clientes MCP (OpenClaw, Claude, Cursor) montam o endpoint de autorização
 * relativo à RAIZ do issuer. Como o conector vive num subcaminho do backend,
 * esta rota recebe o pedido na raiz do nosso domínio e o repassa, com a query
 * intacta, para o authorize real do conector.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OAUTH_BASE } from '@/modules/mvp-copiloto/lib/copilotoApi';

export default function CopilotoAuthorizeRedirect() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = window.location.search;
    if (!query || !query.includes('client_id=')) {
      setError('Pedido de autorização inválido: parâmetros ausentes.');
      return;
    }
    window.location.replace(`${OAUTH_BASE}/authorize${query}`);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      {error ? (
        <p className="text-sm text-destructive max-w-sm">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Encaminhando para a autorização da Julia…
        </p>
      )}
    </main>
  );
}
