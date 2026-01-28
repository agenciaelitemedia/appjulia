import { useState } from 'react';
import { Clock, Eye, Hash, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CRMCard } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppMessagesDialog } from './WhatsAppMessagesDialog';
import { formatDbDateTime } from '@/lib/dateUtils';

interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
}

function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function CRMLeadCard({ card, onClick }: CRMLeadCardProps) {
  const [messagesOpen, setMessagesOpen] = useState(false);
  
  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessagesOpen(true);
  };

  const truncatedBusinessName = truncateText(card.owner_business_name, 20);
  const fullTooltip = card.owner_name || card.owner_business_name
    ? `${card.owner_name || ''}${card.owner_name && card.owner_business_name ? ' • ' : ''}${card.owner_business_name || ''}`
    : card.cod_agent;

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
        style={{ borderLeftColor: card.stage_color || '#6B7280' }}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Contract stage badge - only for leads with contract history */}
            {card.has_contract_history && card.stage_name && (
              <Badge 
                className="text-[10px] font-medium px-2 py-0.5"
                style={{ 
                  backgroundColor: card.stage_color ? `${card.stage_color}20` : undefined,
                  color: card.stage_color || undefined,
                  borderColor: card.stage_color || undefined
                }}
                variant="outline"
              >
                {card.stage_name}
              </Badge>
            )}

            {/* Header with name and actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="text-primary">👤</span>
                <span className="line-clamp-1">{card.whatsapp_number}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                        onClick={handleWhatsApp}
                        title="Ver mensagens"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ver mensagens do WhatsApp</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                      <Badge variant="outline" className="text-[10px] font-normal truncate max-w-full cursor-default">
                        <span className="font-semibold">[{card.cod_agent}]</span>
                        {truncatedBusinessName && <span className="text-muted-foreground"> - {truncatedBusinessName}</span>}
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
                <span>{formatDbDateTime(card.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Atualizado:</span>
                <span>{formatDbDateTime(card.updated_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
                <Clock className="h-3 w-3" />
                <span>Na fase: {timeInStage}</span>
              </div>
              {/* Indicador de timezone */}
              <div className="text-[10px] text-muted-foreground/50 text-right pt-0.5">
                🇧🇷 Horário de Brasília
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Messages Dialog */}
      <WhatsAppMessagesDialog
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        whatsappNumber={card.whatsapp_number}
        leadName={card.contact_name}
        codAgent={card.cod_agent}
      />
    </>
  );
}
