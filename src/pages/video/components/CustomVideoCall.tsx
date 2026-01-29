import { useEffect, useState } from 'react';
import { 
  DailyProvider, 
  useLocalParticipant, 
  useParticipantIds,
  useDailyEvent,
  DailyAudio 
} from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2 } from 'lucide-react';
import { VideoTile } from './VideoTile';
import { VideoControls } from './VideoControls';

interface CustomVideoCallProps {
  roomUrl: string;
  onLeave: () => void;
  onError?: (error: string) => void;
}

function VideoCallContent({ onLeave }: { onLeave: () => void }) {
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

  useEffect(() => {
    let mounted = true;
    let call: ReturnType<typeof DailyIframe.createCallObject> | null = null;

    const initCall = async () => {
      try {
        console.log('[CustomVideoCall] Creating call object...');
        call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });

        call.on('error', (event) => {
          console.error('[CustomVideoCall] Daily error:', event);
          if (mounted) {
            setHasError(true);
            onError?.(event?.errorMsg || 'Erro na conexão');
          }
        });

        call.on('camera-error', (event) => {
          console.warn('[CustomVideoCall] Camera error:', event);
        });

        console.log('[CustomVideoCall] Joining room:', roomUrl);
        
        if (mounted) {
          setCallObject(call);
        }
        
        await call.join({ url: roomUrl });
        
        console.log('[CustomVideoCall] Successfully joined room');
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[CustomVideoCall] Error joining call:', err);
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
        console.log('[CustomVideoCall] Cleaning up call object');
        call.leave().catch(console.warn);
        call.destroy();
      }
    };
  }, [roomUrl]); // Remove onError from dependencies to prevent re-runs

  if (hasError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background rounded-lg">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">Erro ao conectar</p>
          <p className="text-muted-foreground">Tente novamente</p>
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
