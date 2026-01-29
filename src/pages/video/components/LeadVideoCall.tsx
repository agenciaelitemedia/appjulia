import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  DailyProvider, 
  useLocalParticipant, 
  useParticipantIds,
  useDailyEvent,
  DailyAudio 
} from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, Video as VideoIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { VideoTile } from './VideoTile';
import { VideoControls } from './VideoControls';
import { Button } from '@/components/ui/button';

interface LeadVideoCallProps {
  roomUrl: string;
  onLeave: () => void;
  onError?: (error: string) => void;
}

function LeadCallContent({ onLeave }: { onLeave: () => void }) {
  const localParticipant = useLocalParticipant();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const [isConnected, setIsConnected] = useState(false);

  useDailyEvent('joined-meeting', () => {
    setIsConnected(true);
  });

  useDailyEvent('left-meeting', () => {
    onLeave();
  });

  if (!isConnected) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-lg">Entrando na chamada...</p>
        </div>
      </div>
    );
  }

  const hasRemote = remoteParticipantIds.length > 0;

  return (
    <div className="relative h-screen w-screen bg-background">
      {/* Vídeo principal (operador) */}
      <div className="absolute inset-0">
        {hasRemote ? (
          <VideoTile 
            sessionId={remoteParticipantIds[0]} 
            className="w-full h-full rounded-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-4 text-muted-foreground">
              <VideoIcon className="h-16 w-16 mx-auto opacity-50" />
              <p className="text-lg">Aguardando atendente...</p>
              <p className="text-sm">Você será atendido em breve</p>
            </div>
          </div>
        )}
      </div>

      {/* PIP - Minha câmera (lead) */}
      {localParticipant && (
        <div className="absolute bottom-28 right-4 w-32 h-24 shadow-xl sm:w-40 sm:h-28">
          <VideoTile 
            sessionId={localParticipant.session_id} 
            isLocal 
            className="w-full h-full"
          />
        </div>
      )}

      {/* Controles */}
      <VideoControls onLeave={onLeave} />
      
      {/* Áudio */}
      <DailyAudio />
    </div>
  );
}

export function LeadVideoCall({ roomUrl, onLeave, onError }: LeadVideoCallProps) {
  const [callObject, setCallObject] = useState<ReturnType<typeof DailyIframe.createCallObject> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  
  // Refs para prevenir conexões duplicadas e race conditions
  const isConnecting = useRef(false);
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null);

  const handleRetry = useCallback(() => {
    // Limpar estado anterior
    if (callRef.current) {
      try {
        callRef.current.destroy();
      } catch (e) {
        console.warn('[LeadVideoCall] Error destroying on retry:', e);
      }
      callRef.current = null;
    }
    
    setCallObject(null);
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    isConnecting.current = false;
    
    // Incrementar key para forçar re-execução do useEffect
    setRetryKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initCall = async () => {
      // Prevenir conexões duplicadas (importante para React StrictMode)
      if (isConnecting.current || callRef.current) {
        console.log('[LeadVideoCall] Already connecting or connected, skipping');
        return;
      }
      
      isConnecting.current = true;

      try {
        console.log('[LeadVideoCall] Creating call object...');
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        callRef.current = call;

        // Handler de erro com mensagens específicas
        call.on('error', (event) => {
          console.error('[LeadVideoCall] Daily error:', event);
          if (!mounted) return;
          
          let message = 'Erro na conexão';
          if (event?.error?.type === 'meeting-full') {
            message = 'Sala lotada. Aguarde a saída do participante ou tente novamente.';
          } else if (event?.error?.type === 'exp-room') {
            message = 'Esta sala expirou ou não existe mais.';
          } else if (event?.errorMsg) {
            message = event.errorMsg;
          }
          
          setErrorMessage(message);
          setHasError(true);
          setIsLoading(false);
          onError?.(message);
        });

        call.on('camera-error', (event) => {
          console.warn('[LeadVideoCall] Camera error:', event);
        });

        console.log('[LeadVideoCall] Joining room:', roomUrl);
        
        // IMPORTANTE: Join ANTES de setar o state
        await call.join({ url: roomUrl });
        
        console.log('[LeadVideoCall] Successfully joined room');
        
        if (mounted) {
          setCallObject(call);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[LeadVideoCall] Error joining call:', err);
        if (mounted) {
          const message = err?.errorMsg || err?.message || 'Erro ao entrar na chamada';
          setErrorMessage(message);
          setHasError(true);
          setIsLoading(false);
          onError?.(message);
        }
      } finally {
        isConnecting.current = false;
      }
    };

    initCall();

    return () => {
      mounted = false;
      isConnecting.current = false;
      
      const call = callRef.current;
      if (call) {
        console.log('[LeadVideoCall] Cleaning up call object');
        callRef.current = null;
        // Destruir síncronamente no cleanup
        try {
          call.destroy();
        } catch (e) {
          console.warn('[LeadVideoCall] Error destroying:', e);
        }
      }
    };
  }, [roomUrl, retryKey]); // retryKey força re-execução quando retry é clicado

  if (hasError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive text-lg font-medium">Erro ao conectar</p>
          <p className="text-muted-foreground text-sm max-w-xs">{errorMessage}</p>
          <Button onClick={handleRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !callObject) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-lg">Preparando sua chamada...</p>
          <p className="text-muted-foreground text-sm">Permita o acesso à câmera e microfone</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <LeadCallContent onLeave={onLeave} />
    </DailyProvider>
  );
}
