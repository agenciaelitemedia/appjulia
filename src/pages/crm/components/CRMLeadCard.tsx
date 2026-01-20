import { Phone, Clock, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CRMCard } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
}

export function CRMLeadCard({ card, onClick }: CRMLeadCardProps) {
  const formatPhone = (phone: string) => {
    const cleaned = card.whatsapp_number.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = card.whatsapp_number.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: card.stage_color || '#6B7280' }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm leading-tight line-clamp-1">
              {card.contact_name}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-primary hover:text-primary/80 hover:bg-primary/10"
              onClick={handleWhatsApp}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span>{formatPhone(card.whatsapp_number)}</span>
            </div>

            {card.business_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                <span className="line-clamp-1">{card.business_name}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              <span>{timeInStage} neste estágio</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
