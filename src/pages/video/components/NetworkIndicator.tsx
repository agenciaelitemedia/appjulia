import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NetworkQuality } from '../hooks/useVideoSettings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NetworkIndicatorProps {
  quality: NetworkQuality;
  className?: string;
}

const qualityConfig: Record<NetworkQuality, { 
  label: string; 
  color: string; 
  bgColor: string;
  bars: number;
}> = {
  'good': {
    label: 'Conexão boa',
    color: 'text-green-400',
    bgColor: 'bg-green-400',
    bars: 3,
  },
  'low': {
    label: 'Conexão instável',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400',
    bars: 2,
  },
  'very-low': {
    label: 'Conexão ruim',
    color: 'text-red-400',
    bgColor: 'bg-red-400',
    bars: 1,
  },
  'unknown': {
    label: 'Verificando conexão...',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted-foreground',
    bars: 0,
  },
};

export function NetworkIndicator({ quality, className }: NetworkIndicatorProps) {
  const config = qualityConfig[quality];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80",
            className
          )}>
            {quality === 'unknown' ? (
              <WifiOff className={cn("h-3.5 w-3.5", config.color)} />
            ) : (
              <Wifi className={cn("h-3.5 w-3.5", config.color)} />
            )}
            
            {/* Signal bars */}
            <div className="flex items-end gap-0.5 h-3">
              {[1, 2, 3].map((bar) => (
                <div
                  key={bar}
                  className={cn(
                    "w-1 rounded-sm transition-all",
                    bar <= config.bars ? config.bgColor : 'bg-muted-foreground/30',
                  )}
                  style={{ height: `${bar * 4}px` }}
                />
              ))}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
