import { useState } from 'react';
import { Phone, Building2, Clock, History, ArrowRight, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CRMCard, CRMStage } from '../types';
import { useCRMCardHistory, useMoveCard } from '../hooks/useCRMData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface CRMLeadDetailsDialogProps {
  card: CRMCard | null;
  stages: CRMStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CRMLeadDetailsDialog({
  card,
  stages,
  open,
  onOpenChange,
}: CRMLeadDetailsDialogProps) {
  const [selectedStage, setSelectedStage] = useState<string>('');
  const { data: history = [], isLoading: historyLoading } = useCRMCardHistory(card?.id || null);
  const moveCard = useMoveCard();
  const { toast } = useToast();

  if (!card) return null;

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

  const handleWhatsApp = () => {
    const cleanPhone = card.whatsapp.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const handleMoveStage = async () => {
    if (!selectedStage) return;

    try {
      await moveCard.mutateAsync({
        cardId: card.id,
        toStageId: parseInt(selectedStage),
      });
      toast({
        title: 'Lead movido',
        description: 'O lead foi movido para o novo estágio com sucesso.',
      });
      setSelectedStage('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível mover o lead.',
        variant: 'destructive',
      });
    }
  };

  const currentStage = stages.find((s) => s.id === card.stage_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {card.contact_name}
            {currentStage && (
              <Badge
                variant="secondary"
                style={{ backgroundColor: `${currentStage.color}20`, color: currentStage.color }}
              >
                {currentStage.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{formatPhone(card.whatsapp)}</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-primary border-primary hover:bg-primary/10"
                onClick={handleWhatsApp}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
            </div>
            {card.business_name && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{card.business_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Criado em {format(new Date(card.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Notes */}
          {card.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Observações</h4>
                <p className="text-sm text-muted-foreground">{card.notes}</p>
              </div>
            </>
          )}

          {/* Move Stage */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Mover para Estágio</h4>
            <div className="flex gap-2">
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o estágio" />
                </SelectTrigger>
                <SelectContent>
                  {stages
                    .filter((s) => s.id !== card.stage_id)
                    .map((stage) => (
                      <SelectItem key={stage.id} value={stage.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleMoveStage}
                disabled={!selectedStage || moveCard.isPending}
              >
                Mover
              </Button>
            </div>
          </div>

          {/* History */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Movimentações
            </h4>
            <ScrollArea className="h-[150px]">
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded"
                    >
                      <span className="text-muted-foreground">
                        {item.from_stage_name || 'Início'}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium">{item.to_stage_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(item.changed_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
