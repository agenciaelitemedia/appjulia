import { useState, useEffect, useCallback, useRef } from 'react';
import { Video, Mic, MicOff, VideoOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import { QueuePositionIndicator } from './QueuePositionIndicator';
import { InformativeCarousel } from './InformativeCarousel';
import { supabase } from '@/integrations/supabase/client';

interface LeadWaitingRoomProps {
  roomName: string;
  roomUrl: string;
  codAgent: string;
  onOperatorJoined: () => void;
  onError: (error: string) => void;
}

export function LeadWaitingRoom({
  roomName,
  roomUrl,
  codAgent,
  onOperatorJoined,
  onError,
}: LeadWaitingRoomProps) {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasTransitionedRef = useRef(false);

  // Register lead as waiting and get initial queue position
  useEffect(() => {
    if (hasRegistered) return;

    const registerLeadWaiting = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('video-room', {
          body: {
            action: 'lead-waiting',
            roomName,
          },
        });

        if (error) {
          console.error('Failed to register lead waiting:', error);
        } else {
          setHasRegistered(true);
          // Use position directly from lead-waiting response
          if (data?.success) {
            setPosition(data.position || 1);
            setTotalInQueue(data.totalInQueue || 1);
          }
        }
      } catch (err) {
        console.error('Error registering lead:', err);
      }
    };

    registerLeadWaiting();
  }, [roomName, hasRegistered]);

  // Handle operator joined with guard against duplicates
  const handleOperatorJoined = useCallback(() => {
    if (hasTransitionedRef.current) return;
    hasTransitionedRef.current = true;
    
    // Stop camera stream before transitioning
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    console.log('Operator joined! Transitioning to call...');
    onOperatorJoined();
  }, [onOperatorJoined]);

  // Listen for operator joining via realtime
  useRealtimeQueue({
    roomName,
    onOperatorJoined: handleOperatorJoined,
  });

  // Initialize camera preview - only get stream, don't assign to video yet
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;
        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to access camera:', err);
        onError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        setIsInitializing(false);
      }
    };

    initializeCamera();

    return () => {
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onError]);

  // Assign stream to video element AFTER it exists in DOM
  useEffect(() => {
    if (!isInitializing && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn('Video autoplay blocked:', e));
    }
  }, [isInitializing]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sala de Espera</h1>
          <p className="text-muted-foreground mt-1">
            Aguarde enquanto conectamos você ao atendente
          </p>
        </div>

        {/* Camera Preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-muted">
              {isInitializing ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!isCameraOn ? 'opacity-0' : ''}`}
                  />
                  {!isCameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <VideoOff className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </>
              )}

              {/* Controls overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2">
                <Button
                  variant={isMicOn ? 'secondary' : 'destructive'}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  onClick={toggleMic}
                >
                  {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={isCameraOn ? 'secondary' : 'destructive'}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  onClick={toggleCamera}
                >
                  {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Position */}
        <QueuePositionIndicator position={position} totalInQueue={totalInQueue} />

        {/* Informative Carousel */}
        <InformativeCarousel />

        {/* Footer info */}
        <p className="text-xs text-muted-foreground text-center">
          Você será conectado automaticamente quando o atendente entrar na sala
        </p>
      </div>
    </div>
  );
}
