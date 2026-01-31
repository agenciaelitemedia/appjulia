import { Clock, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QueuePositionIndicatorProps {
  position: number;
  totalInQueue: number;
}

function getPositionText(position: number): string {
  if (position === 0) return 'Calculando...';
  if (position === 1) return 'Você é o próximo!';
  return `Você é o ${position}º da fila`;
}

function getPositionVariant(position: number): 'default' | 'secondary' | 'outline' {
  if (position === 1) return 'default';
  if (position <= 3) return 'secondary';
  return 'outline';
}

export function QueuePositionIndicator({ position, totalInQueue }: QueuePositionIndicatorProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {getPositionText(position)}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Aguardando atendente...</span>
              </div>
            </div>
          </div>
          
          {position > 0 && (
            <Badge variant={getPositionVariant(position)} className="text-lg px-3 py-1">
              {position}/{totalInQueue}
            </Badge>
          )}
        </div>

        {position === 1 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-primary">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Você será atendido em breve</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
