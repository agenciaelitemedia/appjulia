import { useDevices } from '@daily-co/daily-react';
import { Settings, Camera, Mic, Volume2, Sparkles, AudioLines } from 'lucide-react';
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
import { useVideoSettings } from '../hooks/useVideoSettings';

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
    backgroundBlur,
    backgroundBlurStrength,
    toggleNoiseCancellation,
    toggleBackgroundBlur,
    setBackgroundBlurStrength,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

          {/* Video Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Vídeo
            </h3>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4" />
                Desfocar fundo
              </Label>
              <Switch
                checked={backgroundBlur}
                onCheckedChange={toggleBackgroundBlur}
              />
            </div>

            {backgroundBlur && (
              <div className="space-y-2 pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Intensidade
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
            Algumas funcionalidades podem não estar disponíveis em todos os navegadores.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
