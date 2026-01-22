import { Phone, Building2, Clock, History, ArrowRight, User, Hash, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CRMCard, CRMStage } from '../types';
import { useCRMCardHistory } from '../hooks/useCRMData';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { data: history = [], isLoading: historyLoading } = useCRMCardHistory(card?.id || null);

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

  const currentStage = stages.find((s) => s.id === card.stage_id);

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
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
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
