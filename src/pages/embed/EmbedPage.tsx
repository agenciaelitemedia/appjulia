import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { embedConfig, type ResolvedEmbed } from '@/lib/embedConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function EmbedPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [embed, setEmbed] = useState<ResolvedEmbed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    embedConfig.resolve(code, Number(user.id))
      .then((data) => {
        if (cancelled) return;
        setEmbed(data);
        if (data.open_in_new_tab && data.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Falha ao carregar embed');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, user?.id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !embed) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Não foi possível abrir o embed</h2>
          <p className="text-sm text-muted-foreground">{error || 'Embed não encontrado'}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">Voltar ao painel</Button>
        </div>
      </div>
    );
  }

  if (embed.open_in_new_tab) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <ExternalLink className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-lg font-semibold">{embed.name}</h2>
          <p className="text-sm text-muted-foreground">O conteúdo foi aberto em uma nova aba.</p>
          <Button onClick={() => window.open(embed.url, '_blank', 'noopener,noreferrer')}>
            Abrir novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={embed.url}
      sandbox={embed.iframe_sandbox}
      referrerPolicy={embed.iframe_referrer_policy as React.HTMLAttributeReferrerPolicy}
      title={embed.name}
      className="w-full"
      style={{ height: 'calc(100vh - 60px)', border: 0 }}
    />
  );
}
