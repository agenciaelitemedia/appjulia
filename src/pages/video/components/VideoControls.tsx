import { useDaily, useLocalParticipant } from '@daily-co/daily-react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoControlsProps {
  onLeave: () => void;
}

export function VideoControls({ onLeave }: VideoControlsProps) {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  
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
      <div className="flex items-center justify-center gap-4">
        {/* Microfone */}
        <Button
          variant="outline"
          size="lg"
          onClick={toggleMic}
          className={cn(
            "rounded-full w-14 h-14 border-2",
            isMuted 
              ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30" 
              : "bg-white/10 border-white/30 text-white hover:bg-white/20"
          )}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {/* Câmera */}
        <Button
          variant="outline"
          size="lg"
          onClick={toggleVideo}
          className={cn(
            "rounded-full w-14 h-14 border-2",
            isVideoOff 
              ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30" 
              : "bg-white/10 border-white/30 text-white hover:bg-white/20"
          )}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>

        {/* Encerrar */}
        <Button
          variant="destructive"
          size="lg"
          onClick={onLeave}
          className="rounded-full w-14 h-14"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Labels */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="text-white/60 text-xs w-14 text-center">
          {isMuted ? 'Mutado' : 'Mic'}
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
