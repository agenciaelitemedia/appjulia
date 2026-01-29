import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { Loader2, Video, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function JoinCallPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const isInitializingRef = useRef(false);
  
  const [status, setStatus] = useState<'loading' | 'joining' | 'connected' | 'error' | 'ended'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!roomName) {
      setStatus('error');
      setErrorMessage('Link inválido');
      return;
    }

    const joinRoom = async () => {
      try {
        // Buscar URL da sala no backend
        const { data, error } = await supabase.functions.invoke<{ success: boolean; room: { url: string } }>('video-room', {
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

        setStatus('joining');

        // Esperar DOM estar pronto
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!containerRef.current || isInitializingRef.current || callFrameRef.current) return;

        isInitializingRef.current = true;

        const callFrame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          lang: 'pt',
        });

        callFrameRef.current = callFrame;

        callFrame.on('joined-meeting', () => {
          setStatus('connected');
        });

        callFrame.on('left-meeting', () => {
          setStatus('ended');
        });

        callFrame.on('error', (event) => {
          console.error('Daily.co error:', event);
          setStatus('error');
          setErrorMessage(event?.errorMsg || 'Erro na conexão');
        });

        await callFrame.join({ url: data.room.url });
      } catch (err) {
        console.error('Error joining room:', err);
        setStatus('error');
        setErrorMessage('Erro ao conectar na sala');
      } finally {
        isInitializingRef.current = false;
      }
    };

    joinRoom();

    return () => {
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying call frame:', e);
        }
        callFrameRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [roomName]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
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
          <h1 className="text-2xl font-bold">Chamada encerrada</h1>
          <p className="text-muted-foreground">
            Obrigado por participar! Você pode fechar esta janela.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <div 
        ref={containerRef} 
        className="w-full h-full"
      />
    </div>
  );
}
