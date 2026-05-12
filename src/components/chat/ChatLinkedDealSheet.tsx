import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { DealDetailsSheet } from '@/pages/crm-builder/components/deals/DealDetailsSheet';
import type { CRMBoard, CRMDeal, CRMDealFormData, CRMPipeline } from '@/pages/crm-builder/types';
import { useMoveDealToBoard } from '@/pages/crm-builder/hooks/useMoveDealToBoard';
import type { ChatLinkedDeal } from '@/hooks/useChatDealLink';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: ChatLinkedDeal;
  onMoved?: () => void;
}

/**
 * Wrapper fino sobre o `DealDetailsSheet` do CRM Builder, usado a partir do
 * botão CRM no header do `/chat` quando a conversa já tem um deal vinculado.
 *
 * Diferenças vs. o uso no Board:
 * - Esconde botões "Ganho", "Perdido" e "Arquivar/Excluir".
 * - Adiciona "Fechar" e "Abrir no CRM" no rodapé.
 *
 * Edições inline (responsável, descrição, valor) são persistidas direto na
 * tabela `crm_deals` e propagadas via invalidação das queries que alimentam
 * o badge CRM da lista de conversas e o botão CRM do header.
 */
export function ChatLinkedDealSheet({ open, onOpenChange, deal, onMoved }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const moveDealToBoard = useMoveDealToBoard();

  // Carrega todas as etapas (pipelines) ativas do board do deal para permitir
  // mover diretamente a partir do sheet do chat.
  const { data: stages = [] } = useQuery({
    queryKey: ['crm-builder-board-pipelines', deal.board_id],
    enabled: open && !!deal.board_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('*')
        .eq('board_id', deal.board_id)
        .eq('is_active', true)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as CRMPipeline[];
    },
  });

  // Carrega lista de quadros do client para permitir mover o card entre quadros
  const { data: boards = [] } = useQuery({
    queryKey: ['crm-builder-boards-min', clientId],
    enabled: open && !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_boards')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as CRMBoard[];
    },
  });

  // Normaliza ChatLinkedDeal -> CRMDeal (campos opcionais com defaults seguros)
  const dealForSheet: CRMDeal = {
    id: deal.id,
    pipeline_id: deal.pipeline_id,
    board_id: deal.board_id,
    cod_agent: deal.cod_agent ?? '',
    client_id: deal.client_id ?? clientId,
    title: deal.title,
    description: deal.description ?? undefined,
    value: deal.value ?? 0,
    currency: deal.currency ?? 'BRL',
    contact_name: deal.contact_name ?? undefined,
    contact_phone: deal.contact_phone ?? undefined,
    contact_email: deal.contact_email ?? undefined,
    priority: (deal.priority ?? 'medium') as CRMDeal['priority'],
    status: (deal.status ?? 'open') as CRMDeal['status'],
    position: 0,
    expected_close_date: deal.expected_close_date ?? undefined,
    custom_fields: (deal.custom_fields ?? {}) as Record<string, unknown>,
    tags: deal.tags ?? [],
    assigned_to: deal.assigned_to ?? undefined,
    stage_entered_at: deal.stage_entered_at ?? deal.updated_at ?? new Date().toISOString(),
    created_at: deal.created_at ?? new Date().toISOString(),
    updated_at: deal.updated_at ?? new Date().toISOString(),
  };

  const pipelineForSheet: CRMPipeline | null = deal.pipeline
    ? ({
        id: deal.pipeline.id,
        board_id: deal.board_id,
        cod_agent: deal.cod_agent ?? '',
        client_id: deal.client_id ?? clientId,
        name: deal.pipeline.name,
        color: deal.pipeline.color ?? '#6b7280',
        position: 0,
        is_active: true,
        win_probability: 0,
        created_at: deal.created_at ?? new Date().toISOString(),
        updated_at: deal.updated_at ?? new Date().toISOString(),
      } as CRMPipeline)
    : null;

  const handleUpdate = async (data: Partial<CRMDealFormData>): Promise<boolean> => {
    try {
      const changedBy = user?.name || null;
      const { error } = await supabase
        .from('crm_deals')
        .update({
          ...(data as Record<string, unknown>),
          updated_at: new Date().toISOString(),
          updated_by: changedBy,
        })
        .eq('id', deal.id);
      if (error) throw error;

      // Histórico (best-effort) — registra autor da edição feita pelo chat
      try {
        const diff: Record<string, unknown> = {};
        Object.entries(data).forEach(([k, v]) => {
          if (v === undefined) return;
          const prevVal = (dealForSheet as unknown as Record<string, unknown>)[k];
          if (JSON.stringify(prevVal) !== JSON.stringify(v)) diff[k] = v;
        });
        if (Object.keys(diff).length > 0) {
          await (supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } })
            .from('crm_deal_history')
            .insert({
              deal_id: deal.id,
              action: 'updated',
              changes: { ...diff, source: 'chat' },
              changed_by: changedBy,
            });
        }
      } catch (historyErr) {
        console.warn('[ChatLinkedDealSheet] history insert failed', historyErr);
      }

      toast.success('Card atualizado');
      // Atualiza o sheet do chat e os badges CRM (header e lista de conversas)
      await queryClient.invalidateQueries({ queryKey: ['chat-deal-link'] });
      await queryClient.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
      // Best-effort: atualiza o board do CRM Builder caso esteja aberto
      await queryClient.invalidateQueries({ queryKey: ['crm-deals', deal.board_id] });
      onMoved?.();
      return true;
    } catch (err) {
      console.error('[ChatLinkedDealSheet] update error', err);
      toast.error('Erro ao atualizar card');
      return false;
    }
  };

  const handleMoveToStage = async (stageId: string): Promise<boolean> => {
    if (stageId === deal.pipeline_id) return true;
    try {
      const changedBy = user?.name || null;
      const { error } = await supabase
        .from('crm_deals')
        .update({
          pipeline_id: stageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: changedBy,
        })
        .eq('id', deal.id);
      if (error) throw error;

      // Histórico (best-effort) — mesmo formato usado pelo board no drag-and-drop
      try {
        await (supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } })
          .from('crm_deal_history')
          .insert({
            deal_id: deal.id,
            action: 'moved',
            from_pipeline_id: deal.pipeline_id,
            to_pipeline_id: stageId,
            changes: { source: 'chat' },
            changed_by: changedBy,
          });
      } catch (historyErr) {
        console.warn('[ChatLinkedDealSheet] history insert failed', historyErr);
      }

      toast.success('Etapa atualizada');
      await queryClient.invalidateQueries({ queryKey: ['chat-deal-link'] });
      await queryClient.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-deals', deal.board_id] });
      onMoved?.();
      return true;
    } catch (err) {
      console.error('[ChatLinkedDealSheet] move stage error', err);
      toast.error('Erro ao mover etapa');
      return false;
    }
  };

  return (
    <DealDetailsSheet
      deal={dealForSheet}
      pipeline={pipelineForSheet}
      open={open}
      onOpenChange={onOpenChange}
      onEdit={() => { /* não usado: hideStatusActions oculta o "Editar" */ }}
      onArchive={() => { /* oculto via hideArchiveAction */ }}
      onWon={() => { /* oculto via hideStatusActions */ }}
      onLost={() => { /* oculto via hideStatusActions */ }}
      onUpdate={handleUpdate}
      stages={stages}
      onMoveToStage={handleMoveToStage}
      boards={boards}
      onMoveToBoard={async (targetBoardId) => {
        const targetBoard = boards.find((b) => b.id === targetBoardId);
        const sourceBoard = boards.find((b) => b.id === deal.board_id);
        const result = await moveDealToBoard(
          dealForSheet,
          targetBoardId,
          targetBoard?.name,
          sourceBoard?.name,
          user?.name,
        );
        if (result) {
          toast.success(`Card movido para "${targetBoard?.name}"`, {
            action: {
              label: 'Abrir cópia',
              onClick: () => navigate(`/crm-builder/${result.newBoardId}?deal=${result.newDealId}`),
            },
          });
          await queryClient.invalidateQueries({ queryKey: ['chat-deal-link'] });
          await queryClient.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
          await queryClient.invalidateQueries({ queryKey: ['crm-deals', deal.board_id] });
          await queryClient.invalidateQueries({ queryKey: ['crm-deals', result.newBoardId] });
          onMoved?.();
        }
        return result;
      }}
      hideStatusActions
      hideArchiveAction
      footerExtra={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate(`/crm-builder/${deal.board_id}?deal=${deal.id}`);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Abrir no CRM
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      }
    />
  );
}
