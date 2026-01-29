import { useState, useEffect } from 'react';
import { Phone, Clock, User, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VideoRoom } from '../types';

interface VideoQueueCardProps {
  room: VideoRoom;
  onJoin: (room: VideoRoom) => void;
  isActive?: boolean;
}

export function VideoQueueCard({ room, onJoin, isActive }: VideoQueueCardProps) {
  const [waitTime, setWaitTime] = useState('');

  useEffect(() => {
    const updateWaitTime = () => {
      setWaitTime(
        formatDistanceToNow(new Date(room.createdAt), {
          addSuffix: false,
          locale: ptBR,
        })
      );
    };
    
    updateWaitTime();
    const interval = setInterval(updateWaitTime, 10000);
    
    return () => clearInterval(interval);
  }, [room.createdAt]);

  // Extract info from room name (format: julia-codagent-timestamp)
  const parts = room.name.split('-');
  const codAgent = parts.length >= 2 ? parts.slice(1, -1).join('-') : 'N/A';

  return (
    <Card className={`transition-all ${isActive ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            {/* Phone number */}
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {room.whatsappNumber || 'Número não informado'}
              </span>
            </div>
            
            {/* Contact name */}
            {room.contactName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{room.contactName}</span>
              </div>
            )}
            
            {/* Wait time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Aguardando há {waitTime}</span>
            </div>
            
            {/* Cod Agent badge */}
            <Badge variant="outline" className="text-xs">
              {codAgent}
            </Badge>
          </div>
          
          {/* Join button */}
          <Button
            onClick={() => onJoin(room)}
            disabled={isActive}
            className="shrink-0"
          >
            <Play className="h-4 w-4 mr-2" />
            {isActive ? 'Em atendimento' : 'Atender'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
