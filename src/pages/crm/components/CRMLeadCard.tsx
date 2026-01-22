import { Phone, Clock, Eye, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CRMCard } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
}

export function CRMLeadCard({ card, onClick }: CRMLeadCardProps) {
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
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

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: card.stage_color || '#6B7280' }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header with WhatsApp and actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <span className="text-primary">👤</span>
              <span className="line-clamp-1">{card.whatsapp_number}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:text-primary/80 hover:bg-primary/10"
                onClick={handleWhatsApp}
                title="Abrir WhatsApp"
              >
                <Phone className="h-4 w-4" />
              </Button>
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

          {/* Phone row */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{formatPhone(card.whatsapp_number)}</span>
          </div>

          {/* Helena Count ID badge */}
          {card.helena_count_id && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <Badge variant="outline" className="text-xs font-mono">
                {card.helena_count_id}
              </Badge>
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
