import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  DailyProvider, 
  useLocalParticipant, 
  useParticipantIds,
  useDailyEvent,
  useMeetingState,
  DailyAudio 
} from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { VideoTile } from './VideoTile';
import { VideoControls } from './VideoControls';
import { Button } from '@/components/ui/button';

interface CustomVideoCallProps {
  roomUrl: string;
  onLeave: () => void;
  onError?: (error: string) => void;
}

function VideoCallContent({ onLeave }: { onLeave: () => void }) {
  const localParticipant = useLocalParticipant();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const meetingState = useMeetingState();

  // Detectar saída via evento (ainda necessário para callback)
  useDailyEvent('left-meeting', useCallback(() => {
    onLeave();
  }, [onLeave]));

  // Estado derivado diretamente do hook - elimina race condition
  const isConnected = meetingState === 'joined-meeting';

  if (!isConnected) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Conectando...</p>
        </div>
      </div>
    );
  }

  const hasRemote = remoteParticipantIds.length > 0;

  return (
    <div className="relative h-full w-full bg-background">
      {/* Vídeo principal (remoto ou local se sozinho) */}
      <div className="absolute inset-0">
        {hasRemote ? (
          <VideoTile 
            sessionId={remoteParticipantIds[0]} 
            className="w-full h-full rounded-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg">Aguardando outro participante...</p>
              <p className="text-sm">O link foi enviado para o contato</p>
            </div>
          </div>
        )}
      </div>

      {/* PIP - Minha câmera */}
      {localParticipant && (
        <div className="absolute bottom-24 right-4 w-40 h-28 shadow-xl">
          <VideoTile 
            sessionId={localParticipant.session_id} 
            isLocal 
            className="w-full h-full"
          />
        </div>
      )}

      {/* Controles */}
      <VideoControls onLeave={onLeave} />
      
      {/* Áudio de todos os participantes */}
      <DailyAudio />
    </div>
  );
}

export function CustomVideoCall({ roomUrl, onLeave, onError }: CustomVideoCallProps) {
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
        console.warn('[CustomVideoCall] Error destroying on retry:', e);
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
        console.log('[CustomVideoCall] Already connecting or connected, skipping');
        return;
      }
      
      isConnecting.current = true;

      try {
        console.log('[CustomVideoCall] Creating call object...');
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        callRef.current = call;

        // Handler de erro com mensagens específicas
        call.on('error', (event) => {
          console.error('[CustomVideoCall] Daily error:', event);
          if (!mounted) return;
          
          let message = 'Erro na conexão';
          if (event?.error?.type === 'meeting-full') {
            message = 'Sala lotada. Aguarde a saída do participante ou crie uma nova sala.';
          } else if (event?.error?.type === 'exp-room') {
            message = 'Sala expirada. Crie uma nova sala.';
          } else if (event?.errorMsg) {
            message = event.errorMsg;
          }
          
          setErrorMessage(message);
          setHasError(true);
          setIsLoading(false);
          onError?.(message);
        });

        call.on('camera-error', (event) => {
          console.warn('[CustomVideoCall] Camera error:', event);
        });

        console.log('[CustomVideoCall] Joining room:', roomUrl);
        
        // IMPORTANTE: Join ANTES de setar o state
        await call.join({ url: roomUrl });
        
        console.log('[CustomVideoCall] Successfully joined room');
        
        if (mounted) {
          setCallObject(call);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[CustomVideoCall] Error joining call:', err);
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
        console.log('[CustomVideoCall] Cleaning up call object');
        callRef.current = null;
        // Destruir síncronamente no cleanup
        try {
          call.destroy();
        } catch (e) {
          console.warn('[CustomVideoCall] Error destroying:', e);
        }
      }
    };
  }, [roomUrl, retryKey]); // retryKey força re-execução quando retry é clicado

  if (hasError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background rounded-lg">
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
      <div className="h-full w-full flex items-center justify-center bg-background rounded-lg">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Iniciando chamada...</p>
          <p className="text-muted-foreground text-sm">Permita o acesso à câmera e microfone</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <VideoCallContent onLeave={onLeave} />
    </DailyProvider>
  );
}
