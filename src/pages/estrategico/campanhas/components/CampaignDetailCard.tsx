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
import { CampaignDetail } from '../types';

interface CampaignDetailCardProps {
  campaign: CampaignDetail;
}

const platformConfig: Record<string, { bg: string; label: string }> = {
  facebook: { bg: 'bg-blue-600', label: 'Facebook' },
  instagram: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', label: 'Instagram' },
  google: { bg: 'bg-red-500', label: 'Google' },
  outros: { bg: 'bg-muted-foreground', label: 'Outros' },
};

export function CampaignDetailCard({ campaign }: CampaignDetailCardProps) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = platformConfig[campaign.platform?.toLowerCase()] || platformConfig.outros;

  const handleCopyPhrase = async () => {
    if (campaign.greeting_message) {
      await navigator.clipboard.writeText(campaign.greeting_message);
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
        
        {/* Platform Badge Overlay */}
        <Badge className={`absolute top-2 left-2 ${platform.bg} text-white border-0`}>
          {platform.label}
        </Badge>
        
        {/* Leads Badge Overlay */}
        <Badge className="absolute top-2 right-2 bg-background/90 text-foreground">
          <Users className="h-3 w-3 mr-1" />
          {campaign.total_leads} leads
        </Badge>

        {/* Play button for media */}
        {campaign.media_url && (
          <a
            href={campaign.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="bg-white/90 rounded-full p-3">
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

        {/* Body */}
        {campaign.campaign_body && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={campaign.campaign_body}>
            {campaign.campaign_body}
          </p>
        )}

        {/* Greeting Message */}
        {campaign.greeting_message && (
          <div className="bg-muted/50 rounded-md p-2 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquareQuote className="h-3 w-3" />
              <span>Frase do lead:</span>
            </div>
            <p className="text-xs line-clamp-2 italic" title={campaign.greeting_message}>
              "{campaign.greeting_message}"
            </p>
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
          {campaign.source_url && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
            >
              <a href={campaign.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Acessar
              </a>
            </Button>
          )}
          
          {campaign.greeting_message && (
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
      </CardContent>
    </Card>
  );
}
