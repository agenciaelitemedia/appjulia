import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Kanban, MessageSquare, Scale, ExternalLink, DollarSign, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useJuliaCardPreview } from '@/pages/crm-builder/hooks/useCardLinks';
import { CRMLeadDetailsDialog } from '@/pages/crm/components/CRMLeadDetailsDialog';
import { useCRMStages } from '@/pages/crm/hooks/useCRMData';
import type { ChatLinkedDeal } from '@/hooks/useChatDealLink';
import type { CRMCard } from '@/pages/crm/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: ChatLinkedDeal;
  onMoved?: () => void;
}

interface BoardPipeline {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

export function ChatLinkedDealSheet({ open, onOpenChange, deal, onMoved }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState(false);
  const [currentPipelineId, setCurrentPipelineId] = useState(deal.pipeline_id);
  const [showJulia, setShowJulia] = useState(false);

  useEffect(() => {
    setCurrentPipelineId(deal.pipeline_id);
  }, [deal.pipeline_id]);

  // Load all pipelines from the deal's board so the user can move the card
  const pipelinesQ = useQuery({
    queryKey: ['board-pipelines', deal.board_id],
    enabled: open && !!deal.board_id,
    staleTime: 60_000,
    queryFn: async (): Promise<BoardPipeline[]> => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('id, name, color, position')
        .eq('board_id', deal.board_id)
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data || []) as BoardPipeline[];
    },
  });

  const links = (deal.custom_fields?.links ?? {}) as { julia?: { card_id: number; whatsapp_number: string; cod_agent: string } };
  const juliaLink = links.julia ?? null;

  const juliaPreview = useJuliaCardPreview(
    juliaLink ? { card_id: juliaLink.card_id, whatsapp_number: juliaLink.whatsapp_number, cod_agent: juliaLink.cod_agent } : null
  );
  const { data: stages = [] } = useCRMStages();

  const currentPipeline = useMemo(
    () => pipelinesQ.data?.find((p) => p.id === currentPipelineId) || deal.pipeline,
    [pipelinesQ.data, currentPipelineId, deal.pipeline]
  );

  const handleMove = async (toPipelineId: string) => {
    if (toPipelineId === currentPipelineId) return;
    const fromPipelineId = currentPipelineId;
    setMoving(true);
    setCurrentPipelineId(toPipelineId); // optimistic
    try {
      const { error } = await supabase
        .from('crm_deals')
        .update({
          pipeline_id: toPipelineId,
          stage_entered_at: new Date().toISOString(),
        })
        .eq('id', deal.id);
      if (error) throw error;

      // record history (best effort)
      try {
        await (supabase as any).from('crm_deal_history').insert({
          deal_id: deal.id,
          action: 'moved',
          from_pipeline_id: fromPipelineId,
          to_pipeline_id: toPipelineId,
          changes: { source: 'chat' },
        });
      } catch { /* noop */ }

      toast.success('Card movido');
      queryClient.invalidateQueries({ queryKey: ['chat-deal-link'] });
      onMoved?.();
    } catch (err) {
      setCurrentPipelineId(fromPipelineId); // revert
      toast.error('Erro ao mover card');
      console.error(err);
    } finally {
      setMoving(false);
    }
  };

  const juliaCardShape: CRMCard | null = juliaPreview.data
    ? {
        id: juliaPreview.data.id,
        cod_agent: juliaPreview.data.cod_agent,
        contact_name: juliaPreview.data.contact_name || '',
        whatsapp_number: juliaPreview.data.whatsapp_number,
        business_name: juliaPreview.data.business_name || undefined,
        stage_id: juliaPreview.data.stage_id,
        stage_name: juliaPreview.data.stage_name || undefined,
        stage_color: juliaPreview.data.stage_color || undefined,
        created_at: juliaPreview.data.updated_at || new Date().toISOString(),
        updated_at: juliaPreview.data.updated_at || new Date().toISOString(),
        stage_entered_at: juliaPreview.data.updated_at || new Date().toISOString(),
      }
    : null;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: deal.currency || 'BRL' }).format(n);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${deal.board?.color || '#3b82f6'}20`,
                  color: deal.board?.color || '#3b82f6',
                }}
              >
                <Kanban className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base truncate">{deal.title}</SheetTitle>
                <SheetDescription className="text-xs truncate">
                  {deal.board?.name || 'Quadro'}
                </SheetDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-2">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 border-blue-500/30 gap-1"
              >
                <MessageSquare className="h-2.5 w-2.5" /> Chat
              </Badge>
              {juliaLink && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-700 border-purple-500/30 gap-1"
                >
                  <Scale className="h-2.5 w-2.5" /> Julia #{juliaLink.card_id}
                </Badge>
              )}
              {currentPipeline && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 gap-1"
                  style={{
                    backgroundColor: `${currentPipeline.color || '#6b7280'}15`,
                    color: currentPipeline.color || '#6b7280',
                    borderColor: `${currentPipeline.color || '#6b7280'}40`,
                  }}
                >
                  {currentPipeline.name}
                </Badge>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-5">
              {/* Move to pipeline */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Mover para outra etapa
                </Label>
                {pipelinesQ.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando etapas...
                  </div>
                ) : (
                  <Select
                    value={currentPipelineId}
                    onValueChange={handleMove}
                    disabled={moving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(pipelinesQ.data || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: p.color || '#6b7280' }}
                            />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {moving && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Movendo...
                  </p>
                )}
              </div>

              <Separator />

              {/* Details */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Detalhes
                </Label>
                {deal.value > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{formatCurrency(deal.value)}</span>
                  </div>
                )}
                {deal.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{deal.contact_name}</span>
                  </div>
                )}
                {deal.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{deal.contact_phone}</span>
                  </div>
                )}
                {deal.priority && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Prioridade: </span>
                    <span className="font-medium capitalize">{deal.priority}</span>
                  </div>
                )}
              </div>

              {/* Julia link */}
              {juliaLink && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Lead da Julia
                    </Label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
                      <Scale className="h-4 w-4 text-purple-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          #{juliaLink.card_id}
                          {juliaPreview.data?.business_name && (
                            <span className="text-muted-foreground"> · {juliaPreview.data.business_name}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          {juliaPreview.isLoading ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> carregando...</>
                          ) : (
                            juliaPreview.data?.stage_name || 'Sem etapa'
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowJulia(true)}
                        disabled={!juliaPreview.data}
                      >
                        Ver
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="p-4 border-t gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate(`/crm-builder/${deal.board_id}?deal=${deal.id}`);
              }}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir no CRM
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {juliaCardShape && (
        <CRMLeadDetailsDialog
          card={juliaCardShape}
          stages={stages}
          open={showJulia}
          onOpenChange={setShowJulia}
        />
      )}
    </>
  );
}