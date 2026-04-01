import { useState, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, Phone, PhoneOff, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ThreeCPlusWebphoneProps {
  codAgent: string;
  extensionId: number;
  extensionLabel?: string;
  extensionNumber?: string;
}

export function ThreeCPlusWebphone({ codAgent, extensionId, extensionLabel, extensionNumber }: ThreeCPlusWebphoneProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'open' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const popupRef = useRef<Window | null>(null);

  // Check if popup was closed
  useEffect(() => {
    if (status !== 'open') return;
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        popupRef.current = null;
        setStatus('idle');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const openWebphone = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('threecplus-proxy', {
        body: { action: 'get_extension_url', codAgent, extensionId },
      });

      if (error) throw new Error(error.message || 'Erro ao obter URL');
      if (data?.error) throw new Error(data.error);

      const url = data?.data?.extensionUrl;
      if (!url) throw new Error('URL do ramal não retornada');

      // Open popup
      const popup = window.open(url, 'threecplus-webphone', 'popup,width=420,height=780,scrollbars=no,resizable=yes');
      if (!popup) {
        toast.error('Popup bloqueado. Permita popups para este site.');
        setStatus('error');
        setErrorMsg('Popup bloqueado pelo navegador');
        return;
      }

      popupRef.current = popup;
      setStatus('open');
      toast.success('Ramal 3C+ aberto');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Erro desconhecido');
      toast.error(err.message || 'Erro ao abrir ramal');
    }
  }, [codAgent, extensionId]);

  const closeWebphone = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setStatus('idle');
  }, []);

  const focusWebphone = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-center flex items-center justify-center gap-2">
          Ramal 3C+
          <Badge variant="secondary" className={
            status === 'open' ? 'bg-green-500/10 text-green-600' :
            status === 'loading' ? 'bg-yellow-500/10 text-yellow-600' :
            status === 'error' ? 'bg-destructive/10 text-destructive' :
            'bg-muted text-muted-foreground'
          }>
            {status === 'open' ? 'Conectado' :
             status === 'loading' ? 'Abrindo...' :
             status === 'error' ? 'Erro' :
             'Desconectado'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Ramal: </span>
            <span className="font-medium">
              {extensionNumber} {extensionLabel ? `(${extensionLabel})` : ''}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] h-5">3C+</Badge>
        </div>

        {status === 'idle' && (
          <div className="text-center py-6 space-y-3">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Clique para abrir o ramal web oficial da 3C+
            </p>
            <Button onClick={openWebphone} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Abrir Ramal Web
            </Button>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center py-6 space-y-3">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Abrindo ramal...</p>
          </div>
        )}

        {status === 'open' && (
          <div className="text-center py-6 space-y-3">
            <Phone className="h-12 w-12 mx-auto text-green-600" />
            <p className="text-sm text-green-600 font-medium">
              Ramal aberto em janela separada
            </p>
            <p className="text-xs text-muted-foreground">
              Use a janela do 3C+ para fazer e receber ligações
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={focusWebphone} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Trazer para frente
              </Button>
              <Button variant="destructive" size="icon" onClick={closeWebphone}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-6 space-y-3">
            <PhoneOff className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" onClick={openWebphone} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
