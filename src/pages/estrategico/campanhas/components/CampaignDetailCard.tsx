import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ExternalLink, 
  ImageOff, 
  Users, 
  Copy, 
  Check,
  Play,
  MessageSquareQuote,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getExternalLink } from '@/lib/externalLink';
import { ExpandableText } from '@/components/ExpandableText';
import { CampaignDetailGrouped, CampaignFunnelData } from '../types';
import { PlatformBadges } from './PlatformBadges';
import { DeviceBadges } from './DeviceBadges';
import { ExpandableSources } from './ExpandableSources';
import { CampaignMiniFunnel } from './CampaignMiniFunnel';

interface CampaignDetailCardProps {
  campaign: CampaignDetailGrouped;
  funnelData?: CampaignFunnelData;
  funnelLoading?: boolean;
}

export function CampaignDetailCard({ campaign, funnelData, funnelLoading }: CampaignDetailCardProps) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPhrase = async () => {
    if (campaign.last_greeting_message) {
      await navigator.clipboard.writeText(campaign.last_greeting_message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header with Agent Info */}
      <CardHeader className="p-3 pb-2 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate" title={`[${campaign.cod_agent}] - ${campaign.office_name}`}>
              [{campaign.cod_agent}] - {campaign.office_name || 'Escritório'}
            </span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <Users className="h-3 w-3 mr-1" />
            {campaign.total_leads}
          </Badge>
        </div>
      </CardHeader>

      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {!imageError && campaign.thumbnail_url ? (
          <img
            src={campaign.thumbnail_url}
            alt={campaign.campaign_title || 'Campanha'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        
        {/* Platform Badges - Stacked on left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <PlatformBadges platforms={campaign.platforms} stacked />
        </div>

        {/* Device Badges - Stacked on right */}
        <div className="absolute top-2 right-2">
          <DeviceBadges devices={campaign.devices} stacked />
        </div>

        {/* Play button for media */}
        {campaign.media_url && (
          <a
            href={getExternalLink(campaign.media_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-background/90 rounded-full p-3">
              <Play className="h-6 w-6 text-foreground fill-current" />
            </div>
          </a>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-sm line-clamp-1" title={campaign.campaign_title}>
          {campaign.campaign_title || 'Sem título'}
        </h3>

        {/* Body - Expandable */}
        {campaign.campaign_body && (
          <ExpandableText 
            text={campaign.campaign_body} 
            maxLines={2}
          />
        )}

        {/* Greeting Message - Expandable */}
        {campaign.last_greeting_message && (
          <div className="bg-muted/50 rounded-md p-2 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquareQuote className="h-3 w-3" />
              <span>Frase do lead:</span>
            </div>
            <ExpandableText 
              text={`"${campaign.last_greeting_message}"`}
              maxLines={2}
              textClassName="italic"
            />
          </div>
        )}

        {/* Dates */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground cursor-help">
                Último lead: {formatDate(campaign.last_lead)}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <p>Primeiro lead: {formatDate(campaign.first_lead)}</p>
                <p>Último lead: {formatDate(campaign.last_lead)}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {campaign.last_source_url && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
            >
              <a href={getExternalLink(campaign.last_source_url)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Acessar
              </a>
            </Button>
          )}
          
          {campaign.last_greeting_message && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyPhrase}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Expandable Sources List */}
        <ExpandableSources sources={campaign.sources} />

        {/* Mini Funnel */}
        {funnelData && <CampaignMiniFunnel data={funnelData} />}
      </CardContent>
    </Card>
  );
}
