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
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { VideoTile } from './VideoTile';
import { VideoControls } from './VideoControls';
import { Button } from '@/components/ui/button';

interface CustomVideoCallProps {
  roomUrl: string;
  onLeave: () => void;
  onError?: (error: string) => void;
}

// Timeout em ms para watchdog
const CONNECTION_TIMEOUT_MS = 20000;

// Variável módulo-level para rastrear instância única (singleton)
let globalCallInstance: ReturnType<typeof DailyIframe.createCallObject> | null = null;

// Função helper para destruir instância existente
async function destroyExistingInstance() {
  if (globalCallInstance) {
    console.log('[CustomVideoCall] Destruindo instância global anterior...');
    try {
      await globalCallInstance.leave();
      globalCallInstance.destroy();
    } catch (e) {
      console.warn('[CustomVideoCall] Erro ao destruir instância anterior:', e);
    }
    globalCallInstance = null;
  }
}

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
    console.log('[CustomVideoCall] meetingState ->', meetingState);
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
        console.error('[CustomVideoCall] Timeout: não conectou em', CONNECTION_TIMEOUT_MS, 'ms. meetingState:', meetingState);
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
        console.log('[CustomVideoCall] Iniciando join para:', roomUrl);
        await daily.join({ url: roomUrl });
        console.log('[CustomVideoCall] Join completado com sucesso');
      } catch (err: any) {
        console.error('[CustomVideoCall] Erro no join:', err);
        onJoinError(err?.errorMsg || err?.message || 'Erro ao entrar na chamada');
      }
    };

    doJoin();
  }, [daily, roomUrl, onJoinError]);

  return null;
}

// Componente que renderiza o conteúdo da chamada
function VideoCallContent({ onLeave }: { onLeave: () => void }) {
  const localParticipant = useLocalParticipant();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const meetingState = useMeetingState();

  // Detectar saída via evento
  useDailyEvent('left-meeting', useCallback(() => {
    console.log('[CustomVideoCall] Evento left-meeting recebido');
    onLeave();
  }, [onLeave]));

  const isConnected = meetingState === 'joined-meeting';

  // Debug info
  const debugInfo = `Estado: ${meetingState || 'null'}`;

  if (!isConnected) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Conectando...</p>
          {/* Debug footer */}
          <p className="text-xs text-muted-foreground/50 font-mono">{debugInfo}</p>
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
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [debugState, setDebugState] = useState<string>('Inicializando...');
  const [retryKey, setRetryKey] = useState(0);
  
  const callRef = useRef<ReturnType<typeof DailyIframe.createCallObject> | null>(null);

  const handleError = useCallback((msg: string) => {
    console.error('[CustomVideoCall] handleError:', msg);
    setErrorMessage(msg);
    setHasError(true);
    onError?.(msg);
  }, [onError]);

  const handleTimeout = useCallback(async () => {
    console.log('[CustomVideoCall] Timeout - destruindo instância...');
    await destroyExistingInstance();
    callRef.current = null;
    setCallObject(null);
    handleError('Conexão demorou muito. Verifique sua internet e tente novamente.');
  }, [handleError]);

  const handleRetry = useCallback(async () => {
    console.log('[CustomVideoCall] Retry solicitado');
    // Destruir instância global antes de recriar
    await destroyExistingInstance();
    callRef.current = null;
    
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

    const createCallObject = async () => {
      // SEMPRE destruir instância anterior primeiro (garante singleton)
      await destroyExistingInstance();
      
      if (!mounted) return;

      if (callRef.current) {
        console.log('[CustomVideoCall] Call object já existe no ref, pulando criação');
        return;
      }

      try {
        console.log('[CustomVideoCall] Criando call object...');
        setDebugState('Criando conexão...');
        
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        // Registrar globalmente E no ref
        globalCallInstance = call;
        callRef.current = call;

        // Handler de erro do Daily
        call.on('error', (event) => {
          console.error('[CustomVideoCall] Daily error event:', event);
          if (!mounted) return;
          
          let message = 'Erro na conexão';
          if (event?.error?.type === 'meeting-full') {
            message = 'Sala lotada. Aguarde ou crie uma nova sala.';
          } else if (event?.error?.type === 'exp-room') {
            message = 'Sala expirada. Crie uma nova sala.';
          } else if (event?.errorMsg) {
            message = event.errorMsg;
          }
          
          handleError(message);
        });

        call.on('camera-error', (event) => {
          console.warn('[CustomVideoCall] Camera error:', event);
        });

        if (mounted) {
          setCallObject(call);
          setDebugState('Aguardando provider...');
        }
      } catch (err: any) {
        console.error('[CustomVideoCall] Erro ao criar call object:', err);
        if (mounted) {
          handleError(err?.message || 'Erro ao inicializar chamada');
        }
      }
    };

    createCallObject();

    return () => {
      mounted = false;
      // Cleanup: destruir instância global
      destroyExistingInstance();
      callRef.current = null;
    };
  }, [retryKey, handleError]);

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

  if (!callObject) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background rounded-lg">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Iniciando chamada...</p>
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
      <VideoCallContent onLeave={onLeave} />
    </DailyProvider>
  );
}
