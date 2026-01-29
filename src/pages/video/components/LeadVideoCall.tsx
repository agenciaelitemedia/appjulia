import { useEffect, useState } from 'react';
import { 
  DailyProvider, 
  useLocalParticipant, 
  useParticipantIds,
  useDailyEvent,
  DailyAudio 
} from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, Video as VideoIcon } from 'lucide-react';
import { VideoTile } from './VideoTile';
import { VideoControls } from './VideoControls';

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

  useEffect(() => {
    let mounted = true;
    let call: ReturnType<typeof DailyIframe.createCallObject> | null = null;

    const initCall = async () => {
      try {
        console.log('[LeadVideoCall] Creating call object...');
        call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });

        call.on('error', (event) => {
          console.error('[LeadVideoCall] Daily error:', event);
          if (mounted) {
            setHasError(true);
            onError?.(event?.errorMsg || 'Erro na conexão');
          }
        });

        call.on('camera-error', (event) => {
          console.warn('[LeadVideoCall] Camera error:', event);
        });

        console.log('[LeadVideoCall] Joining room:', roomUrl);
        
        if (mounted) {
          setCallObject(call);
        }
        
        await call.join({ url: roomUrl });
        
        console.log('[LeadVideoCall] Successfully joined room');
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[LeadVideoCall] Error joining call:', err);
        if (mounted) {
          setHasError(true);
          onError?.('Erro ao entrar na chamada');
        }
      }
    };

    initCall();

    return () => {
      mounted = false;
      if (call) {
        console.log('[LeadVideoCall] Cleaning up call object');
        call.leave().catch(console.warn);
        call.destroy();
      }
    };
  }, [roomUrl]); // Remove onError from dependencies to prevent re-runs

  if (hasError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">Erro ao conectar</p>
          <p className="text-muted-foreground">Tente recarregar a página</p>
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
