import { DailyVideo, useParticipant, useActiveSpeakerId } from '@daily-co/daily-react';
import { Mic, MicOff, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoTileProps {
  sessionId: string;
  isLocal?: boolean;
  className?: string;
}

export function VideoTile({ sessionId, isLocal = false, className }: VideoTileProps) {
  const participant = useParticipant(sessionId);
  const activeSpeakerId = useActiveSpeakerId();
  
  if (!participant) return null;

  const hasVideo = participant.video;
  const hasAudio = participant.audio;
  const userName = participant.user_name || (isLocal ? 'Você' : 'Participante');
  const isActiveSpeaker = sessionId === activeSpeakerId && !isLocal;

  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden bg-muted transition-all duration-300",
        isActiveSpeaker && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className
      )}
    >
      {hasVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          automirror={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <User className="h-12 w-12" />
            <span className="text-sm">{userName}</span>
          </div>
        </div>
      )}
      
      {/* Nome do participante */}
      <div className={cn(
        "absolute bottom-2 left-2 px-2 py-1 bg-background/80 rounded text-foreground text-sm flex items-center gap-2",
        isActiveSpeaker && "bg-primary/90 text-primary-foreground"
      )}>
        {hasAudio ? (
          <Mic className={cn("h-3 w-3", isActiveSpeaker ? "text-primary-foreground" : "text-primary")} />
        ) : (
          <MicOff className="h-3 w-3 text-destructive" />
        )}
        <span className="truncate max-w-[120px]">{userName}</span>
        {isActiveSpeaker && (
          <span className="text-xs opacity-75">• Falando</span>
        )}
      </div>
    </div>
  );
}
