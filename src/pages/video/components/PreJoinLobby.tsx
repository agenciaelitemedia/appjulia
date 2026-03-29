import { useEffect, useState, useCallback, useRef } from 'react';
import { DailyProvider, useDaily, useDevices, useLocalParticipant } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Settings, 
  Loader2, 
  AlertCircle,
  PhoneCall
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { VideoSettingsModal } from './VideoSettingsModal';

interface PreJoinLobbyProps {
  roomUrl: string;
  onJoin: () => void;
  onCancel: () => void;
  userName?: string;
}

// Singleton para lobby
let lobbyCallInstance: ReturnType<typeof DailyIframe.createCallObject> | null = null;

async function destroyLobbyInstance() {
  if (lobbyCallInstance) {
    try {
      // Turn off camera/mic before destroying
      lobbyCallInstance.setLocalAudio(false);
      lobbyCallInstance.setLocalVideo(false);
      lobbyCallInstance.destroy();
    } catch (e) {
      console.warn('[PreJoinLobby] Erro ao destruir instância:', e);
    }
    lobbyCallInstance = null;
  }
}

// Inner component with access to Daily context
function LobbyContent({ 
  onJoin, 
  onCancel, 
  userName 
}: { 
  onJoin: () => void; 
  onCancel: () => void;
  userName?: string;
}) {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const {
    cameras,
    microphones,
    currentCam,
    currentMic,
    setCamera,
    setMicrophone,
  } = useDevices();

  const [isStartingCamera, setIsStartingCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedCamera = useRef(false);

  // Start camera for preview
  useEffect(() => {
    if (!daily || hasStartedCamera.current) return;

    const startPreview = async () => {
      hasStartedCamera.current = true;
      setIsStartingCamera(true);
      setCameraError(null);

      try {
        await daily.startCamera({
          startVideoOff: false,
          startAudioOff: false,
        });
        setIsStartingCamera(false);
      } catch (err: any) {
        console.error('[PreJoinLobby] Camera start error:', err);
        setCameraError(err?.message || 'Não foi possível acessar a câmera');
        setIsStartingCamera(false);
      }
    };

    startPreview();
  }, [daily]);

  // Update video element with local track
  useEffect(() => {
    if (!daily || !videoRef.current) return;

    const updateVideoTrack = () => {
      const participants = daily.participants();
      const local = participants?.local;
      
      if (local?.tracks?.video?.persistentTrack && videoRef.current) {
        const stream = new MediaStream([local.tracks.video.persistentTrack]);
        videoRef.current.srcObject = stream;
      }
    };

    // Initial update
    updateVideoTrack();

    // Listen for track changes
    daily.on('track-started', updateVideoTrack);
    daily.on('participant-updated', updateVideoTrack);

    return () => {
      daily.off('track-started', updateVideoTrack);
      daily.off('participant-updated', updateVideoTrack);
    };
  }, [daily, localParticipant]);

  const toggleAudio = useCallback(() => {
    if (!daily) return;
    const newValue = !audioEnabled;
    daily.setLocalAudio(newValue);
    setAudioEnabled(newValue);
  }, [daily, audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (!daily) return;
    const newValue = !videoEnabled;
    daily.setLocalVideo(newValue);
    setVideoEnabled(newValue);
  }, [daily, videoEnabled]);

  const handleJoin = useCallback(async () => {
    if (!daily) return;
    
    // Set initial audio/video state for join
    await daily.setLocalAudio(audioEnabled);
    await daily.setLocalVideo(videoEnabled);
    
    onJoin();
  }, [daily, audioEnabled, videoEnabled, onJoin]);

  if (isStartingCamera) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Iniciando câmera...</p>
          <p className="text-sm text-muted-foreground/70">
            Permita o acesso à câmera e microfone
          </p>
        </div>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Erro de Acesso</p>
          <p className="text-muted-foreground text-sm">{cameraError}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Preparar para a chamada</CardTitle>
        <CardDescription>
          Verifique sua câmera e microfone antes de entrar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Preview */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {videoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <VideoOff className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Câmera desligada</p>
              </div>
            </div>
          )}

          {/* Audio/Video toggles overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={toggleAudio}
              className={cn(
                "rounded-full w-12 h-12",
                !audioEnabled && "bg-destructive/20 border-destructive text-destructive"
              )}
            >
              {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={toggleVideo}
              className={cn(
                "rounded-full w-12 h-12",
                !videoEnabled && "bg-destructive/20 border-destructive text-destructive"
              )}
            >
              {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setSettingsOpen(true)}
              className="rounded-full w-12 h-12"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>

          {/* User name badge */}
          {userName && (
            <div className="absolute top-4 left-4 bg-background/80 px-3 py-1.5 rounded-full text-sm">
              {userName}
            </div>
          )}
        </div>

        {/* Quick device selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Mic className="h-4 w-4" />
              Microfone
            </Label>
            <Select
              value={currentMic?.device?.deviceId || ''}
              onValueChange={setMicrophone}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {microphones.map((mic) => (
                  <SelectItem key={mic.device.deviceId} value={mic.device.deviceId}>
                    {mic.device.label || `Mic ${mic.device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4" />
              Câmera
            </Label>
            <Select
              value={currentCam?.device?.deviceId || ''}
              onValueChange={setCamera}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((cam) => (
                  <SelectItem key={cam.device.deviceId} value={cam.device.deviceId}>
                    {cam.device.label || `Cam ${cam.device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleJoin} className="flex-1 gap-2">
            <PhoneCall className="h-4 w-4" />
            Entrar na Chamada
          </Button>
        </div>

        {/* Settings Modal */}
        <VideoSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </CardContent>
    </Card>
  );
}

export function PreJoinLobby({ roomUrl, onJoin, onCancel, userName }: PreJoinLobbyProps) {
  const [callObject, setCallObject] = useState<ReturnType<typeof DailyIframe.createCallObject> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create call object for preview (without joining)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await destroyLobbyInstance();
      
      if (!mounted) return;

      try {
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: false,
        });
        
        lobbyCallInstance = call;

        call.on('error', (event) => {
          console.error('[PreJoinLobby] Daily error:', event);
          if (mounted) {
            setError(event?.errorMsg || 'Erro ao inicializar');
          }
        });

        if (mounted) {
          setCallObject(call);
        }
      } catch (err: any) {
        console.error('[PreJoinLobby] Init error:', err);
        if (mounted) {
          setError(err?.message || 'Erro ao inicializar');
        }
      }
    };

    init();

    return () => {
      mounted = false;
      destroyLobbyInstance();
    };
  }, []);

  // Handle join - destroy lobby and trigger parent join
  const handleJoin = useCallback(async () => {
    await destroyLobbyInstance();
    setCallObject(null);
    onJoin();
  }, [onJoin]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    await destroyLobbyInstance();
    setCallObject(null);
    onCancel();
  }, [onCancel]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={onCancel}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Preparando preview...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <LobbyContent 
        onJoin={handleJoin} 
        onCancel={handleCancel}
        userName={userName}
      />
    </DailyProvider>
  );
}
