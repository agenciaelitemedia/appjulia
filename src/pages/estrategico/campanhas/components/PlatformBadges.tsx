import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlatformBadgesProps {
  platforms: string[];
  className?: string;
  stacked?: boolean;
}

const platformConfig: Record<string, { bg: string; label: string }> = {
  facebook: { bg: 'bg-blue-600', label: 'FB' },
  instagram: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', label: 'IG' },
  google: { bg: 'bg-red-500', label: 'Google' },
  outros: { bg: 'bg-muted-foreground', label: 'Outros' },
};

export function PlatformBadges({ platforms, className, stacked = false }: PlatformBadgesProps) {
  const uniquePlatforms = [...new Set(platforms.map(p => p?.toLowerCase() || 'outros'))];

  if (uniquePlatforms.length === 0) return null;

  return (
    <div className={cn(
      "flex gap-1",
      stacked ? "flex-col items-start" : "flex-row flex-wrap",
      className
    )}>
      {uniquePlatforms.map((platform) => {
        const config = platformConfig[platform] || platformConfig.outros;
        return (
          <Badge
            key={platform}
            className={cn(
              config.bg,
              "text-white border-0 text-[10px] px-1.5 py-0.5"
            )}
          >
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
}
