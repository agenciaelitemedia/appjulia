import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { DealDetailsSheet } from '@/pages/crm-builder/components/deals/DealDetailsSheet';
import type { CRMDeal, CRMDealFormData, CRMPipeline } from '@/pages/crm-builder/types';
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
      const { error } = await supabase
        .from('crm_deals')
        .update({ ...(data as Record<string, unknown>), updated_at: new Date().toISOString() })
        .eq('id', deal.id);
      if (error) throw error;

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
