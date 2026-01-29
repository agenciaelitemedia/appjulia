import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  DailyProvider, 
  useDaily,
  useLocalParticipant, 
  useParticipantIds,
  useDailyEvent,
  useMeetingState,
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

// Timeout em ms para watchdog
const CONNECTION_TIMEOUT_MS = 20000;

// Componente interno que faz o join DENTRO do provider
function VideoCallJoiner({ 
  roomUrl, 
  onJoinError,
  onTimeout 
}: { 
  roomUrl: string;
  onJoinError: (msg: string) => void;
  onTimeout: () => void;
}) {
  const daily = useDaily();
  const meetingState = useMeetingState();
  const hasJoined = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log de transições de estado
  useEffect(() => {
    console.log('[LeadVideoCall] meetingState ->', meetingState);
  }, [meetingState]);

  // Watchdog: se não conectar em X segundos, dispara timeout
  useEffect(() => {
    if (meetingState === 'joined-meeting') {
      // Conectou, limpar timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Iniciar watchdog apenas se ainda não temos um
    if (!timeoutRef.current && meetingState !== 'error' && meetingState !== 'left-meeting') {
      timeoutRef.current = setTimeout(() => {
        console.error('[LeadVideoCall] Timeout: não conectou em', CONNECTION_TIMEOUT_MS, 'ms. meetingState:', meetingState);
        onTimeout();
      }, CONNECTION_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [meetingState, onTimeout]);

  // Executar join assim que o daily estiver pronto
  useEffect(() => {
    if (!daily || hasJoined.current) return;

    const doJoin = async () => {
      hasJoined.current = true;
      try {
        console.log('[LeadVideoCall] Iniciando join para:', roomUrl);
        await daily.join({ url: roomUrl });
        console.log('[LeadVideoCall] Join completado com sucesso');
      } catch (err: any) {
        console.error('[LeadVideoCall] Erro no join:', err);
        onJoinError(err?.errorMsg || err?.message || 'Erro ao entrar na chamada');
      }
    };

    doJoin();
  }, [daily, roomUrl, onJoinError]);

  return null;
}

// Componente que renderiza o conteúdo da chamada
function LeadCallContent({ onLeave }: { onLeave: () => void }) {
  const localParticipant = useLocalParticipant();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const meetingState = useMeetingState();

  // Detectar saída via evento
  useDailyEvent('left-meeting', useCallback(() => {
    console.log('[LeadVideoCall] Evento left-meeting recebido');
    onLeave();
  }, [onLeave]));

  const isConnected = meetingState === 'joined-meeting';

  // Debug info
  const debugInfo = `Estado: ${meetingState || 'null'}`;

  if (!isConnected) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-lg">Entrando na chamada...</p>
          {/* Debug footer */}
          <p className="text-xs text-muted-foreground/50 font-mono">{debugInfo}</p>
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
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [debugState, setDebugState] = useState<string>('Inicializando...');
  const [retryKey, setRetryKey] = useState(0);
  
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null);

  const handleError = useCallback((msg: string) => {
    console.error('[LeadVideoCall] handleError:', msg);
    setErrorMessage(msg);
    setHasError(true);
    onError?.(msg);
  }, [onError]);

  const handleTimeout = useCallback(() => {
    const call = callRef.current;
    if (call) {
      try {
        call.leave();
        call.destroy();
      } catch (e) {
        console.warn('[LeadVideoCall] Erro ao limpar após timeout:', e);
      }
      callRef.current = null;
    }
    setCallObject(null);
    handleError('Conexão demorou muito. Verifique sua internet e tente novamente.');
  }, [handleError]);

  const handleRetry = useCallback(() => {
    console.log('[LeadVideoCall] Retry solicitado');
    // Limpar estado anterior
    if (callRef.current) {
      try {
        callRef.current.leave();
        callRef.current.destroy();
      } catch (e) {
        console.warn('[LeadVideoCall] Erro ao destruir no retry:', e);
      }
      callRef.current = null;
    }
    
    setCallObject(null);
    setHasError(false);
    setErrorMessage('');
    setDebugState('Reconectando...');
    
    // Incrementar key para forçar re-criação
    setRetryKey(prev => prev + 1);
  }, []);

  // Criar call object (SEM fazer join aqui)
  useEffect(() => {
    let mounted = true;

    const createCallObject = () => {
      if (callRef.current) {
        console.log('[LeadVideoCall] Call object já existe, pulando criação');
        return;
      }

      try {
        console.log('[LeadVideoCall] Criando call object...');
        setDebugState('Criando conexão...');
        
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        callRef.current = call;

        // Handler de erro do Daily
        call.on('error', (event) => {
          console.error('[LeadVideoCall] Daily error event:', event);
          if (!mounted) return;
          
          let message = 'Erro na conexão';
          if (event?.error?.type === 'meeting-full') {
            message = 'Sala lotada. Aguarde ou tente novamente.';
          } else if (event?.error?.type === 'exp-room') {
            message = 'Esta sala expirou.';
          } else if (event?.errorMsg) {
            message = event.errorMsg;
          }
          
          handleError(message);
        });

        call.on('camera-error', (event) => {
          console.warn('[LeadVideoCall] Camera error:', event);
        });

        if (mounted) {
          setCallObject(call);
          setDebugState('Aguardando provider...');
        }
      } catch (err: any) {
        console.error('[LeadVideoCall] Erro ao criar call object:', err);
        if (mounted) {
          handleError(err?.message || 'Erro ao inicializar chamada');
        }
      }
    };

    createCallObject();

    return () => {
      mounted = false;
      const call = callRef.current;
      if (call) {
        console.log('[LeadVideoCall] Cleanup: destruindo call object');
        callRef.current = null;
        try {
          call.leave();
          call.destroy();
        } catch (e) {
          console.warn('[LeadVideoCall] Erro no cleanup:', e);
        }
      }
    };
  }, [retryKey, handleError]);

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

  if (!callObject) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-lg">Preparando sua chamada...</p>
          <p className="text-muted-foreground text-sm">Permita o acesso à câmera e microfone</p>
          {/* Debug footer */}
          <p className="text-xs text-muted-foreground/50 font-mono">{debugState}</p>
        </div>
      </div>
    );
  }

  // Provider monta PRIMEIRO, depois o Joiner faz o join DENTRO do provider
  return (
    <DailyProvider callObject={callObject}>
      <VideoCallJoiner 
        roomUrl={roomUrl} 
        onJoinError={handleError}
        onTimeout={handleTimeout}
      />
      <LeadCallContent onLeave={onLeave} />
    </DailyProvider>
  );
}
