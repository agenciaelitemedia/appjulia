import { useEffect, useRef, useCallback, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneOff, Maximize2, Minimize2, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCallEmbedProps {
  roomUrl: string;
  contactName?: string;
  whatsappNumber?: string;
  onLeave?: () => void;
  onError?: (error: Error) => void;
}

export function VideoCallEmbed({
  roomUrl,
  contactName,
  whatsappNumber,
  onLeave,
  onError,
}: VideoCallEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const isInitializingRef = useRef(false);
  const onLeaveRef = useRef(onLeave);
  const onErrorRef = useRef(onError);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Keep refs updated
  useEffect(() => {
    onLeaveRef.current = onLeave;
    onErrorRef.current = onError;
  }, [onLeave, onError]);

  // Timer for call duration
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeave = useCallback(() => {
    if (callFrameRef.current) {
      try {
        callFrameRef.current.leave();
        callFrameRef.current.destroy();
      } catch (e) {
        console.warn('Error leaving call:', e);
      }
      callFrameRef.current = null;
    }
    setIsConnected(false);
    onLeaveRef.current?.();
  }, []);

  // Initialize Daily.co call - only depends on roomUrl
  useEffect(() => {
    if (!containerRef.current || !roomUrl) return;
    
    // Prevent duplicate initialization
    if (isInitializingRef.current || callFrameRef.current) {
      return;
    }

    isInitializingRef.current = true;

    const initCall = async () => {
      try {
        // Double-check we haven't already created a frame
        if (callFrameRef.current) {
          isInitializingRef.current = false;
          return;
        }

        const callFrame = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '8px',
          },
          showLeaveButton: false,
          showFullscreenButton: false,
        });

        callFrameRef.current = callFrame;

        callFrame.on('joined-meeting', () => {
          setIsConnected(true);
        });

        callFrame.on('left-meeting', () => {
          setIsConnected(false);
          onLeaveRef.current?.();
        });

        callFrame.on('error', (event) => {
          console.error('Daily.co error:', event);
          onErrorRef.current?.(new Error(event?.errorMsg || 'Unknown error'));
        });

        await callFrame.join({ url: roomUrl });
      } catch (error) {
        console.error('Error initializing call:', error);
        // Only call onError if it's not a duplicate instance error
        if (!(error instanceof Error && error.message.includes('Duplicate'))) {
          onErrorRef.current?.(error as Error);
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    initCall();

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
  }, [roomUrl]); // Only roomUrl as dependency

  const toggleMute = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <Card className={cn("flex flex-col", isFullscreen && "fixed inset-0 z-50 rounded-none")}>
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              )} />
              <span className={cn(
                "relative inline-flex rounded-full h-3 w-3",
                isConnected ? "bg-emerald-600" : "bg-amber-600"
              )} />
            </span>
            {isConnected ? 'Em chamada' : 'Conectando...'}
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {contactName && <span className="font-medium">{contactName}</span>}
            {whatsappNumber && <span>({whatsappNumber})</span>}
            {isConnected && (
              <span className="font-mono bg-muted px-2 py-1 rounded">
                {formatDuration(duration)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 relative">
        <div 
          ref={containerRef} 
          className="w-full h-full min-h-[400px] bg-muted"
        />
        
        {/* Controls overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            onClick={toggleMute}
            className="rounded-full"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full"
          >
            {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="destructive"
            size="icon"
            onClick={handleLeave}
            className="rounded-full h-12 w-12"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleFullscreen}
            className="rounded-full"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
