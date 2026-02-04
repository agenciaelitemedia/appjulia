import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getExternalLink } from '@/lib/externalLink';
import { CampaignSource } from '../types';
import { DeviceBadges } from './DeviceBadges';

interface ExpandableSourcesProps {
  sources: CampaignSource[];
  className?: string;
}

const platformConfig: Record<string, { bg: string; label: string }> = {
  facebook: { bg: 'bg-blue-600', label: 'FB' },
  instagram: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', label: 'IG' },
  google: { bg: 'bg-red-500', label: 'Google' },
  outros: { bg: 'bg-muted-foreground', label: 'Outros' },
};

export function ExpandableSources({ sources, className }: ExpandableSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Remove duplicates by source_url
  const uniqueSources = sources.reduce((acc, source) => {
    if (source.source_url && !acc.find(s => s.source_url === source.source_url)) {
      acc.push(source);
    }
    return acc;
  }, [] as CampaignSource[]);

  if (uniqueSources.length <= 1) return null;

  const handleCopy = async (url: string, index: number) => {
    await navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname.length > 20 ? urlObj.pathname.substring(0, 20) + '...' : urlObj.pathname);
    } catch {
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-auto py-2 px-2 text-xs"
        >
          <span className="text-muted-foreground">
            Ver todas as URLs ({uniqueSources.length})
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-1">
        {uniqueSources.map((source, index) => {
          const platform = platformConfig[source.platform?.toLowerCase()] || platformConfig.outros;
          
          return (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs"
            >
              <Badge
                className={cn(
                  platform.bg,
                  "text-white border-0 text-[9px] px-1 py-0 shrink-0"
                )}
              >
                {platform.label}
              </Badge>
              
              <DeviceBadges devices={[source.device]} stacked={false} />
              
              <a
                href={getExternalLink(source.source_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-muted-foreground hover:text-primary truncate"
                title={source.source_url}
              >
                {formatUrl(source.source_url)}
              </a>
              
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(source.source_url, index)}
                >
                  {copiedIndex === index ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <a
                  href={getExternalLink(source.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
