import { useState } from 'react';
import { Clock, Eye, Building2, DollarSign, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ComercialCard } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePhone } from '@/contexts/PhoneContext';
import { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';

interface Props {
  card: ComercialCard;
  onClick: () => void;
}

export function ComercialLeadCard({ card, onClick }: Props) {
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const { isAvailable } = usePhone();

  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('cardId', String(card.id));
    e.dataTransfer.setData('fromStageId', String(card.stage_id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePhoneCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhoneCallOpen(true);
  };

  return (
    <>
      <Card
        draggable
        onDragStart={handleDragStart}
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4"
        style={{ borderLeftColor: card.stage_color || '#6B7280' }}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium line-clamp-1">
                    👤 {card.contact_name || 'Sem nome'}
                  </span>
                  {card.origin === 'vellip' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-400 text-orange-600 bg-orange-50 shrink-0">
                      <Phone className="h-2.5 w-2.5 mr-0.5" />
                      Vellip
                    </Badge>
                  )}
                </div>
                {card.contact_phone && (
                  <span className="text-xs text-muted-foreground pl-5">{card.contact_phone}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAvailable && card.contact_phone && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full text-orange-500 border-orange-500/30 hover:bg-orange-100/50 dark:hover:bg-orange-900/30"
                          onClick={handlePhoneCall}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Ligar via ramal</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                  title="Ver detalhes"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {card.company_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="line-clamp-1">{card.company_name}</span>
              </div>
            )}

            {card.value != null && card.value > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <DollarSign className="h-3 w-3" />
                <span>R$ {Number(card.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>Na fase: {timeInStage}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {card.contact_phone && (
        <PhoneCallDialog
          open={phoneCallOpen}
          onOpenChange={setPhoneCallOpen}
          whatsappNumber={card.contact_phone}
          contactName={card.contact_name || 'Sem nome'}
          codAgent={card.cod_agent || ''}
        />
      )}
    </>
  );
}
