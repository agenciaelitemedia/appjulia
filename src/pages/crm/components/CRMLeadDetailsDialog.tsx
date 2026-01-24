import { Phone, Building2, Clock, History, ArrowRight, User, Hash, Calendar, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDbDateTime } from '@/lib/dateUtils';

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

  const currentStage = card ? stages.find((s) => s.id === card.stage_id) : null;
  const entryStage = stages.find((s) => s.position === 1) || { name: 'Entrada', color: '#3B82F6' };

  // Histórico sintético quando a tabela está vazia
  const syntheticHistory = useMemo(() => {
    if (history.length > 0 || !card) return null;
    
    const entries: Array<{
      id: number;
      card_id: number;
      from_stage_id: number | null;
      to_stage_id: number;
      from_stage_name: string | null;
      to_stage_name: string;
      from_stage_color: string | null;
      to_stage_color: string;
      changed_by: string;
      changed_at: string;
      notes: string | null;
    }> = [];

    // Entrada de criação
    entries.push({
      id: -1,
      card_id: card.id,
      from_stage_id: null,
      to_stage_id: 1,
      from_stage_name: null,
      to_stage_name: entryStage.name,
      from_stage_color: null,
      to_stage_color: entryStage.color,
      changed_by: 'Sistema',
      changed_at: card.created_at,
      notes: 'Lead criado via WhatsApp',
    });

    // Se stage_entered_at != created_at, houve pelo menos uma mudança
    const enteredAt = new Date(card.stage_entered_at).getTime();
    const createdAt = new Date(card.created_at).getTime();
    
    if (enteredAt > createdAt + 60000 && currentStage) {
      entries.push({
        id: 0,
        card_id: card.id,
        from_stage_id: null,
        to_stage_id: card.stage_id,
        from_stage_name: null,
        to_stage_name: currentStage.name,
        from_stage_color: null,
        to_stage_color: currentStage.color,
        changed_by: 'Sistema JulIA',
        changed_at: card.stage_entered_at,
        notes: card.notes || 'Movimentação automática',
      });
    }

    return entries;
  }, [history, card, currentStage, entryStage]);

  const displayHistory = history.length > 0 ? history : syntheticHistory || [];
  const isSyntheticHistory = history.length === 0 && syntheticHistory && syntheticHistory.length > 0;

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
                  {formatDbDateTime(card.created_at)}
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
                  desde {formatDbDateTime(card.stage_entered_at)}
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
              
              {isSyntheticHistory && (
                <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Histórico parcial - baseado nos dados do card
                </div>
              )}
              
              <div className="space-y-2">
                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : displayHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    Nenhuma movimentação registrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {displayHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm p-3 bg-muted/30 rounded-lg"
                      >
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDbDateTime(item.changed_at)}
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
