import { useCallback, useRef, useState } from 'react';
import { useDevices } from '@daily-co/daily-react';
import { Settings, Camera, Mic, Volume2, Sparkles, AudioLines, Ban, Upload, Loader2, X } from 'lucide-react';
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
import { toast } from 'sonner';

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customBackgrounds, setCustomBackgrounds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        
        // Add to custom backgrounds (keep max 4)
        setCustomBackgrounds(prev => [dataUrl, ...prev].slice(0, 4));
        
        // Set as current background
        await setBackgroundImage(dataUrl);
        setIsUploading(false);
        toast.success('Fundo personalizado aplicado!');
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast.error('Erro ao carregar a imagem');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading background:', error);
      setIsUploading(false);
      toast.error('Erro ao processar a imagem');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setBackgroundImage]);

  const handleRemoveCustomBackground = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomBackgrounds(prev => prev.filter(bg => bg !== url));
    
    // If this was the active background, reset to none
    if (backgroundImageUrl === url) {
      removeBackground();
    }
  }, [backgroundImageUrl, removeBackground]);

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
            <div className="grid grid-cols-4 gap-2">
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
                <Ban className="h-5 w-5 text-muted-foreground" />
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
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Upload button */}
              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className={cn(
                  "relative aspect-video rounded-lg border-2 border-dashed overflow-hidden transition-all flex items-center justify-center bg-muted/50",
                  "border-border hover:border-primary/50 hover:bg-muted"
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Custom uploaded backgrounds */}
              {customBackgrounds.map((url, idx) => (
                <button
                  key={`custom-${idx}`}
                  onClick={() => handleBackgroundSelect('image', url)}
                  className={cn(
                    "relative aspect-video rounded-lg border-2 overflow-hidden transition-all group",
                    backgroundType === 'image' && backgroundImageUrl === url
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <img 
                    src={url} 
                    alt={`Fundo personalizado ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => handleRemoveCustomBackground(url, e)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </button>
              ))}

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
