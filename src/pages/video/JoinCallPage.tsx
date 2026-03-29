import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LeadVideoCall } from './components/LeadVideoCall';
import { LeadWaitingRoom } from './components/LeadWaitingRoom';

interface RoomData {
  name: string;
  url: string;
  codAgent?: string;
  contactName?: string;
  operatorJoined?: boolean;
}

type PageStatus = 'loading' | 'waiting' | 'ready' | 'error' | 'ended';

export default function JoinCallPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!roomName) {
      setStatus('error');
      setErrorMessage('Link inválido');
      return;
    }

    const fetchRoom = async () => {
      try {
        const { data, error } = await supabase.functions.invoke<{ 
          success: boolean; 
          room: RoomData;
          error?: string;
        }>('video-room', {
          body: {
            action: 'join',
            roomName,
          },
        });

        if (error || !data?.success || !data.room?.url) {
          setStatus('error');
          setErrorMessage('Sala não encontrada ou expirada');
          return;
        }

        setRoomData(data.room);
        
        // If operator already joined, go directly to call
        if (data.room.operatorJoined) {
          setStatus('ready');
        } else {
          // Otherwise, show waiting room
          setStatus('waiting');
        }
      } catch (err) {
        console.error('Error fetching room:', err);
        setStatus('error');
        setErrorMessage('Erro ao conectar na sala');
      }
    };

    fetchRoom();
  }, [roomName]);

  const handleOperatorJoined = useCallback(() => {
    setStatus('ready');
  }, []);

  const handleLeave = useCallback(() => {
    setStatus('ended');
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Video call error:', error);
    setStatus('error');
    setErrorMessage(error);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-lg text-muted-foreground">Carregando sala...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Não foi possível entrar</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
          <p className="text-sm text-muted-foreground">
            Entre em contato para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <Video className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Reunião encerrada</h1>
          <p className="text-muted-foreground">
            Obrigado por participar! Você pode fechar esta janela.
          </p>
        </div>
      </div>
    );
  }

  if (!roomData || !roomName) {
    return null;
  }

  // Waiting room - lead waits for operator
  if (status === 'waiting') {
    return (
      <LeadWaitingRoom
        roomName={roomName}
        roomUrl={roomData.url}
        codAgent={roomData.codAgent || ''}
        onOperatorJoined={handleOperatorJoined}
        onError={handleError}
      />
    );
  }

  // Ready to join - operator is in the room
  return (
    <LeadVideoCall
      roomUrl={roomData.url}
      onLeave={handleLeave}
      onError={handleError}
    />
  );
}
