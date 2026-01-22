import { useState } from 'react';
import { Phone, Building2, Clock, History, ArrowRight, MessageSquare, User, Hash, Calendar, ExternalLink } from 'lucide-react';
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
import { format, formatDistanceToNow } from 'date-fns';
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
    const cleanPhone = card.whatsapp_number.replace(/\D/g, '');
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
  const timeInStage = formatDistanceToNow(new Date(card.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>Nome</span>
                </div>
                <p className="text-sm font-medium">{card.contact_name || card.whatsapp_number}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </div>
                <p className="text-sm font-medium">{formatPhone(card.whatsapp_number)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Empresa</span>
                </div>
                <p className="text-sm font-medium">{card.business_name || '-'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span>Cod. Agente</span>
                </div>
                <Badge variant="outline" className="font-mono">
                  {card.cod_agent}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Criado em</span>
                </div>
                <p className="text-sm font-medium">
                  {format(new Date(card.created_at), "dd/MM/yy, HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span>ID</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {card.helena_count_id || card.id}
                </p>
              </div>
            </div>

            {/* Current Stage */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Fase Atual</h4>
              <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  {currentStage && (
                    <Badge
                      style={{ backgroundColor: `${currentStage.color}20`, color: currentStage.color }}
                    >
                      {currentStage.name}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    desde {format(new Date(card.stage_entered_at), "dd/MM/yy, HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleWhatsApp}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir atendimento
                </Button>
              </div>
            </div>

            {/* Notes */}
            {card.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Observações</h4>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.notes}</p>
                  </div>
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
              <div className="space-y-2">
                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    Nenhuma movimentação registrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm p-3 bg-muted/30 rounded-lg"
                      >
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(item.changed_at), 'dd/MM/yy, HH:mm', { locale: ptBR })}
                        </span>
                        
                        {item.from_stage_name ? (
                          <Badge
                            variant="outline"
                            className="shrink-0"
                            style={{ 
                              backgroundColor: `${item.from_stage_color}15`, 
                              borderColor: item.from_stage_color,
                              color: item.from_stage_color 
                            }}
                          >
                            {item.from_stage_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Entrada</span>
                        )}
                        
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        
                        <Badge
                          className="shrink-0"
                          style={{ 
                            backgroundColor: `${item.to_stage_color}20`, 
                            color: item.to_stage_color 
                          }}
                        >
                          {item.to_stage_name}
                        </Badge>
                        
                        <span className="ml-auto text-xs font-medium text-muted-foreground uppercase shrink-0">
                          {item.changed_by || 'SISTEMA'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
