import { Phone, Building2, Clock, History, ArrowRight, User, Hash, Calendar, AlertTriangle, Scale, Download, Loader2, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CRMCard, CRMStage } from '../types';
import { useCRMCardHistory } from '../hooks/useCRMData';
import { useContractInfo } from '../hooks/useContractInfo';
import { ContractInfoDialog } from './ContractInfoDialog';
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
  const { toast } = useToast();
  const { data: history = [], isLoading: historyLoading } = useCRMCardHistory(card?.id || null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const currentStage = card ? stages.find((s) => s.id === card.stage_id) : null;
  const entryStage = stages.find((s) => s.position === 1) || { name: 'Entrada', color: '#3B82F6' };
  
  // Check if card is in contract stage
  const isContractStage = currentStage?.name === 'Contrato em Curso' || 
                          currentStage?.name === 'Contrato Assinado';
  
  // Fetch contract info only when in contract stage
  const { data: contractInfo } = useContractInfo(
    card?.whatsapp_number || '',
    card?.cod_agent || '',
    isContractStage && open
  );

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

  const handleDownloadContract = async () => {
    if (!contractInfo?.zapsing_doctoken) {
      toast({
        title: 'Erro',
        description: 'Contrato sem token para download',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/zapsign-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ doc_token: contractInfo.zapsing_doctoken, file: 'signed' }),
      });

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao obter documento');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const disposition = response.headers.get('Content-Disposition');
      let fileName = `${contractInfo.signer_name || card?.contact_name || 'contrato'}.pdf`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) {
          fileName = match[1];
        }
      }
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: 'Download concluído',
        description: 'O contrato foi baixado com sucesso',
      });

    } catch (error) {
      console.error('Erro ao baixar contrato:', error);
      toast({
        title: 'Erro ao baixar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
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

            {/* Contract Actions - Only for contract stages */}
            {isContractStage && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Contrato
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setContractDialogOpen(true)}
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                    
                    {contractInfo?.status_document === 'SIGNED' && contractInfo.zapsing_doctoken ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleDownloadContract}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Baixar Contrato
                      </Button>
                    ) : contractInfo?.cod_document ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`https://app.zapsign.com.br/verificar/${contractInfo.cod_document}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver Documentos
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            )}

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

        {/* Contract Details Dialog */}
        <ContractInfoDialog
          open={contractDialogOpen}
          onOpenChange={setContractDialogOpen}
          whatsappNumber={card.whatsapp_number}
          codAgent={card.cod_agent}
          contactName={card.contact_name}
        />
      </DialogContent>
    </Dialog>
  );
}
