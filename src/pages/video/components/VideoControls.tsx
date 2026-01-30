import { useDaily, useLocalParticipant } from '@daily-co/daily-react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NetworkIndicator } from './NetworkIndicator';
import { useVideoSettings } from '../hooks/useVideoSettings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VideoControlsProps {
  onLeave: () => void;
}

export function VideoControls({ onLeave }: VideoControlsProps) {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const { noiseCancellation, networkQuality, toggleNoiseCancellation } = useVideoSettings();
  
  const isMuted = !localParticipant?.audio;
  const isVideoOff = !localParticipant?.video;

  const toggleMic = () => {
    daily?.setLocalAudio(!localParticipant?.audio);
  };

  const toggleVideo = () => {
    daily?.setLocalVideo(!localParticipant?.video);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
      {/* Network indicator */}
      <div className="absolute top-0 left-4">
        <NetworkIndicator quality={networkQuality} />
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <TooltipProvider>
          {/* Microfone */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={toggleMic}
                className={cn(
                  "rounded-full w-14 h-14 border-2",
                  isMuted 
                    ? "bg-destructive/20 border-destructive text-destructive hover:bg-destructive/30" 
                    : "bg-background/10 border-border/30 text-foreground hover:bg-background/20"
                )}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? 'Ativar microfone' : 'Desativar microfone'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Cancelamento de Ruído */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={toggleNoiseCancellation}
                className={cn(
                  "rounded-full w-14 h-14 border-2",
                  noiseCancellation 
                    ? "bg-primary/20 border-primary text-primary hover:bg-primary/30" 
                    : "bg-background/10 border-border/30 text-foreground hover:bg-background/20"
                )}
              >
                <AudioLines className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{noiseCancellation ? 'Desativar cancelamento de ruído' : 'Ativar cancelamento de ruído'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Câmera */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                onClick={toggleVideo}
                className={cn(
                  "rounded-full w-14 h-14 border-2",
                  isVideoOff 
                    ? "bg-destructive/20 border-destructive text-destructive hover:bg-destructive/30" 
                    : "bg-background/10 border-border/30 text-foreground hover:bg-background/20"
                )}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isVideoOff ? 'Ativar câmera' : 'Desativar câmera'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Encerrar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                onClick={onLeave}
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Encerrar chamada</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Labels */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="text-white/60 text-xs w-14 text-center">
          {isMuted ? 'Mutado' : 'Mic'}
        </span>
        <span className="text-white/60 text-xs w-14 text-center">
          {noiseCancellation ? 'Ruído' : 'Ruído'}
        </span>
        <span className="text-white/60 text-xs w-14 text-center">
          {isVideoOff ? 'Desligada' : 'Câmera'}
        </span>
        <span className="text-white/60 text-xs w-14 text-center">
          Encerrar
        </span>
      </div>
    </div>
  );
}
