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

  useEffect(() => {
    let mounted = true;
    let call: ReturnType<typeof DailyIframe.createCallObject> | null = null;

    const initCall = async () => {
      try {
        call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });

        call.on('error', (event) => {
          console.error('Daily error:', event);
          onError?.(event?.errorMsg || 'Erro na conexão');
        });

        if (mounted) {
          setCallObject(call);
        }
        
        await call.join({ url: roomUrl });
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error joining call:', err);
        onError?.('Erro ao entrar na chamada');
      }
    };

    initCall();

    return () => {
      mounted = false;
      if (call) {
        call.leave().catch(console.warn);
        call.destroy();
      }
    };
  }, [roomUrl, onError]);

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
