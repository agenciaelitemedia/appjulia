import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RedirectPage() {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(2);
  const [error, setError] = useState(false);

  const url = searchParams.get('url');
  const decodedUrl = url ? decodeURIComponent(url) : null;

  useEffect(() => {
    if (!decodedUrl) {
      setError(true);
      return;
    }

    // Validate URL
    try {
      new URL(decodedUrl);
    } catch {
      setError(true);
      return;
    }

    // Countdown timer
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Escape iframe if needed
          try {
            const targetWindow = window.top || window;
            targetWindow.location.href = decodedUrl;
          } catch {
            // Fallback for cross-origin
            window.location.href = decodedUrl;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [decodedUrl]);

  const handleManualRedirect = () => {
    if (decodedUrl) {
      try {
        const targetWindow = window.top || window;
        targetWindow.location.href = decodedUrl;
      } catch {
        window.location.href = decodedUrl;
      }
    }
  };

  const handleGoBack = () => {
    window.history.back();
  };

  if (error || !decodedUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              O link de redirecionamento não é válido ou está ausente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleGoBack} variant="outline">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <CardTitle>Redirecionando...</CardTitle>
          <CardDescription className="space-y-2">
            <p>Você será redirecionado em {countdown} segundo{countdown !== 1 ? 's' : ''}.</p>
            <p className="text-xs text-muted-foreground break-all mt-2">
              {decodedUrl.length > 60 ? `${decodedUrl.substring(0, 60)}...` : decodedUrl}
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={handleManualRedirect} className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Continuar agora
          </Button>
          <Button onClick={handleGoBack} variant="outline" className="w-full">
            Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
