import { Smartphone, Monitor, Laptop, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DeviceBadgesProps {
  devices: string[];
  className?: string;
  stacked?: boolean;
}

const deviceConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  android: { icon: Smartphone, label: 'Android', color: 'text-green-600' },
  ios: { icon: Smartphone, label: 'iOS', color: 'text-muted-foreground' },
  iphone: { icon: Smartphone, label: 'iPhone', color: 'text-muted-foreground' },
  windows: { icon: Monitor, label: 'Windows', color: 'text-blue-500' },
  macos: { icon: Laptop, label: 'macOS', color: 'text-muted-foreground' },
  mac: { icon: Laptop, label: 'Mac', color: 'text-muted-foreground' },
  linux: { icon: Monitor, label: 'Linux', color: 'text-orange-500' },
  unknown: { icon: HelpCircle, label: 'Desconhecido', color: 'text-muted-foreground' },
};

function normalizeDevice(device: string): string {
  const normalized = device?.toLowerCase()?.trim() || 'unknown';
  if (normalized.includes('android')) return 'android';
  if (normalized.includes('iphone') || normalized.includes('ios')) return 'ios';
  if (normalized.includes('windows')) return 'windows';
  if (normalized.includes('mac')) return 'macos';
  if (normalized.includes('linux')) return 'linux';
  return 'unknown';
}

export function DeviceBadges({ devices, className, stacked = true }: DeviceBadgesProps) {
  const uniqueDevices = [...new Set(devices.map(normalizeDevice))].filter(d => d !== 'unknown' || devices.length === 1);

  if (uniqueDevices.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn(
        "flex gap-1",
        stacked ? "flex-col items-start" : "flex-row flex-wrap",
        className
      )}>
        {uniqueDevices.map((device) => {
          const config = deviceConfig[device] || deviceConfig.unknown;
          const Icon = config.icon;
          return (
            <Tooltip key={device}>
              <TooltipTrigger asChild>
                <div className={cn("p-1 rounded", config.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">{config.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
