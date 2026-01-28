import { useState } from 'react';
import { Clock, Eye, Hash, MessageCircle, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CRMCard } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppMessagesDialog } from './WhatsAppMessagesDialog';
import { ContractInfoDialog } from './ContractInfoDialog';
import { formatDbDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

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
  const [contractOpen, setContractOpen] = useState(false);
  
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

  const handleContract = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContractOpen(true);
  };

  const truncatedBusinessName = truncateText(card.owner_business_name, 20);
  const fullTooltip = card.owner_name || card.owner_business_name
    ? `${card.owner_name || ''}${card.owner_name && card.owner_business_name ? ' • ' : ''}${card.owner_business_name || ''}`
    : card.cod_agent;

  // Determine contract status based on stage name
  const isContractSigned = card.stage_name === 'Contrato Assinado';
  const isContractInProgress = card.stage_name === 'Contrato em Curso';

  return (
    <>
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
                {/* Contract Icon - only for leads with contract history */}
                {card.has_contract_history && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 relative transition-all duration-300",
                            "hover:scale-110",
                            isContractSigned
                              ? "text-green-500 hover:bg-green-100/50 dark:hover:bg-green-900/30 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                              : "text-cyan-500 hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30 shadow-[0_0_8px_rgba(6,182,212,0.4)]",
                            "animate-pulse"
                          )}
                          onClick={handleContract}
                        >
                          <Scale className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isContractSigned ? 'Contrato Assinado' : 'Contrato em Curso'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
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

      {/* Contract Info Dialog */}
      <ContractInfoDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        whatsappNumber={card.whatsapp_number}
        codAgent={card.cod_agent}
        contactName={card.contact_name}
      />
    </>
  );
}
