import { useDevices } from '@daily-co/daily-react';
import { Settings, Camera, Mic, Volume2, Sparkles, AudioLines, ImageIcon, Ban } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useVideoSettings, DEFAULT_BACKGROUNDS, BackgroundType } from '../hooks/useVideoSettings';

interface VideoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoSettingsModal({ open, onOpenChange }: VideoSettingsModalProps) {
  const {
    cameras,
    microphones,
    speakers,
    currentCam,
    currentMic,
    currentSpeaker,
    setCamera,
    setMicrophone,
    setSpeaker,
  } = useDevices();

  const {
    noiseCancellation,
    backgroundType,
    backgroundBlurStrength,
    backgroundImageUrl,
    toggleNoiseCancellation,
    setBackgroundType,
    setBackgroundBlurStrength,
    setBackgroundImage,
    removeBackground,
  } = useVideoSettings();

  const handleCameraChange = (deviceId: string) => {
    setCamera(deviceId);
  };

  const handleMicrophoneChange = (deviceId: string) => {
    setMicrophone(deviceId);
  };

  const handleSpeakerChange = (deviceId: string) => {
    setSpeaker(deviceId);
  };

  const handleBlurStrengthChange = (value: number[]) => {
    setBackgroundBlurStrength(value[0]);
  };

  const handleBackgroundSelect = (type: BackgroundType, imageUrl?: string) => {
    if (type === 'image' && imageUrl) {
      setBackgroundImage(imageUrl);
    } else if (type === 'blur') {
      setBackgroundType('blur');
    } else {
      removeBackground();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Vídeo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Device Selection Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dispositivos
            </h3>

            {/* Camera */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Câmera
              </Label>
              <Select
                value={currentCam?.device?.deviceId || ''}
                onValueChange={handleCameraChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma câmera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((camera) => (
                    <SelectItem
                      key={camera.device.deviceId}
                      value={camera.device.deviceId}
                    >
                      {camera.device.label || `Câmera ${camera.device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Microphone */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Microfone
              </Label>
              <Select
                value={currentMic?.device?.deviceId || ''}
                onValueChange={handleMicrophoneChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um microfone" />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((mic) => (
                    <SelectItem
                      key={mic.device.deviceId}
                      value={mic.device.deviceId}
                    >
                      {mic.device.label || `Microfone ${mic.device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Alto-falante
              </Label>
              <Select
                value={currentSpeaker?.device?.deviceId || ''}
                onValueChange={handleSpeakerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um alto-falante" />
                </SelectTrigger>
                <SelectContent>
                  {speakers.map((speaker) => (
                    <SelectItem
                      key={speaker.device.deviceId}
                      value={speaker.device.deviceId}
                    >
                      {speaker.device.label || `Alto-falante ${speaker.device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Audio Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Áudio
            </h3>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 cursor-pointer">
                <AudioLines className="h-4 w-4" />
                Cancelamento de ruído
              </Label>
              <Switch
                checked={noiseCancellation}
                onCheckedChange={toggleNoiseCancellation}
              />
            </div>
          </div>

          <Separator />

          {/* Video Background Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Fundo do Vídeo
            </h3>

            {/* Background Options Grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* None option */}
              <button
                onClick={() => handleBackgroundSelect('none')}
                className={cn(
                  "relative aspect-video rounded-lg border-2 overflow-hidden transition-all flex items-center justify-center bg-muted",
                  backgroundType === 'none' 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Ban className="h-6 w-6 text-muted-foreground" />
                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-muted-foreground truncate text-center">
                  Nenhum
                </span>
              </button>

              {/* Blur option */}
              <button
                onClick={() => handleBackgroundSelect('blur')}
                className={cn(
                  "relative aspect-video rounded-lg border-2 overflow-hidden transition-all flex items-center justify-center bg-gradient-to-br from-muted to-muted/50",
                  backgroundType === 'blur' 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Sparkles className="h-6 w-6 text-muted-foreground" />
                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-muted-foreground truncate text-center">
                  Desfoque
                </span>
              </button>

              {/* Default background images */}
              {DEFAULT_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => handleBackgroundSelect('image', bg.url)}
                  className={cn(
                    "relative aspect-video rounded-lg border-2 overflow-hidden transition-all",
                    backgroundType === 'image' && backgroundImageUrl === bg.url
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <img 
                    src={bg.url} 
                    alt={bg.name} 
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] text-foreground truncate text-center py-0.5">
                    {bg.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Blur strength slider (only when blur is active) */}
            {backgroundType === 'blur' && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Intensidade do desfoque
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(backgroundBlurStrength * 100)}%
                  </span>
                </div>
                <Slider
                  value={[backgroundBlurStrength]}
                  onValueChange={handleBlurStrengthChange}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Compatibility Note */}
          <p className="text-xs text-muted-foreground text-center">
            Fundos virtuais funcionam melhor em Chrome, Edge e Firefox (desktop).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
