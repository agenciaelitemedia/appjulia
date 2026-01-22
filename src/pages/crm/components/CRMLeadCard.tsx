import { Clock, Eye, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CRMCard } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
}

function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function CRMLeadCard({ card, onClick }: CRMLeadCardProps) {
  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const truncatedBusinessName = truncateText(card.owner_business_name, 20);
  const badgeText = `[${card.cod_agent}]${truncatedBusinessName ? ` - ${truncatedBusinessName}` : ''}`;
  const fullTooltip = card.owner_name || card.owner_business_name
    ? `${card.owner_name || ''}${card.owner_name && card.owner_business_name ? ' • ' : ''}${card.owner_business_name || ''}`
    : card.cod_agent;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: card.stage_color || '#6B7280' }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header with name and actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <span className="text-primary">👤</span>
              <span className="line-clamp-1">{card.whatsapp_number}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleDetails}
                title="Ver detalhes"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cod Agent badge with tooltip */}
          {card.cod_agent && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs font-mono truncate max-w-full cursor-default">
                      {badgeText}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{fullTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Dates and time in stage */}
          <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Criado:</span>
              <span>{format(new Date(card.created_at), "dd/MM/yy, HH:mm", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Atualizado:</span>
              <span>{format(new Date(card.updated_at), "dd/MM/yy, HH:mm", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
              <Clock className="h-3 w-3" />
              <span>Na fase: {timeInStage}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
