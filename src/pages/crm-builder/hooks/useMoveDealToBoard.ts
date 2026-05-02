import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMDeal } from '../types';

export interface MoveDealToBoardResult {
  newDealId: string;
  newBoardId: string;
  newPipelineId: string;
}

/**
 * Move um deal para outro quadro (board) criando uma cópia no destino e
 * arquivando o original. Mantém o vínculo de conversa (custom_fields.links)
 * apenas na cópia — o original tem os links removidos para não duplicar
 * referência ativa à mesma conversa.
 */
export function useMoveDealToBoard() {
  const { toast } = useToast();

  return useCallback(async (
    deal: CRMDeal,
    targetBoardId: string,
    targetBoardName?: string,
    sourceBoardName?: string,
    userName?: string,
  ): Promise<MoveDealToBoardResult | null> => {
    try {
      // 1. Pega a primeira pipeline ativa do board destino
      const { data: targetPipelines, error: pipelinesErr } = await supabase
        .from('crm_pipelines')
        .select('id, name, position')
        .eq('board_id', targetBoardId)
        .eq('is_active', true)
        .order('position', { ascending: true })
        .limit(1);

      if (pipelinesErr) throw pipelinesErr;
      const firstPipeline = targetPipelines?.[0];
      if (!firstPipeline) {
        throw new Error('O quadro de destino não possui etapas ativas.');
      }

      // 2. Calcula próxima position no destino
      const { data: existing, error: posErr } = await supabase
        .from('crm_deals')
        .select('position')
        .eq('pipeline_id', firstPipeline.id)
        .order('position', { ascending: false })
        .limit(1);
      if (posErr) throw posErr;
      const nextPosition = (existing?.[0]?.position ?? -1) + 1;

      // 3. INSERT cópia no destino (mantém custom_fields/links)
      const insertPayload = {
        pipeline_id: firstPipeline.id,
        board_id: targetBoardId,
        client_id: deal.client_id,
        cod_agent: deal.cod_agent,
        title: deal.title,
        description: deal.description ?? null,
        value: deal.value ?? 0,
        currency: deal.currency || 'BRL',
        contact_name: deal.contact_name ?? null,
        contact_phone: deal.contact_phone ?? null,
        contact_email: deal.contact_email ?? null,
        priority: deal.priority || 'medium',
        status: 'open',
        expected_close_date: deal.expected_close_date ?? null,
        due_date: deal.due_date ?? null,
        tags: deal.tags ?? [],
        assigned_to: deal.assigned_to ?? null,
        position: nextPosition,
        custom_fields: JSON.parse(JSON.stringify(deal.custom_fields ?? {})),
        // Preserva data original de criação para que o card "movido" mantenha
        // sua identidade temporal — UI exibe a mesma data do card de origem.
        created_at: deal.created_at,
      } as never;

      const { data: newDeal, error: insertError } = await supabase
        .from('crm_deals')
        .insert([insertPayload])
        .select('id, board_id, pipeline_id')
        .single();

      if (insertError) throw insertError;

      // 4. Copia todo o histórico do card original para o novo, preservando
      //    timestamps e ações. Pipelines do board antigo não existem no destino,
      //    então zeramos from/to_pipeline_id para não violar a FK; mantemos o
      //    nome da etapa antiga em `notes` para contexto quando aplicável.
      try {
        const { data: originalHistory, error: histFetchErr } = await supabase
          .from('crm_deal_history')
          .select('action, from_pipeline_id, to_pipeline_id, changed_by, changed_at, changes, notes')
          .eq('deal_id', deal.id)
          .order('changed_at', { ascending: true });

        if (histFetchErr) throw histFetchErr;

        if (originalHistory && originalHistory.length > 0) {
          const rowsToCopy = originalHistory.map((h) => ({
            deal_id: newDeal.id,
            action: h.action,
            // Pipelines antigos não existem no novo board → null
            from_pipeline_id: null as string | null,
            to_pipeline_id: null as string | null,
            changed_by: h.changed_by ?? null,
            changed_at: h.changed_at, // preserva timeline original
            changes: h.changes ?? {},
            notes: h.notes ?? null,
          }));

          const { error: histInsertErr } = await supabase
            .from('crm_deal_history')
            .insert(rowsToCopy);

          if (histInsertErr) throw histInsertErr;
        }
      } catch (historyCopyErr) {
        console.warn('[useMoveDealToBoard] falha ao copiar histórico', historyCopyErr);
      }

      // 4b. Adiciona o evento da movimentação como entrada nova no novo deal
      await supabase.from('crm_deal_history').insert({
        deal_id: newDeal.id,
        action: 'moved',
        to_pipeline_id: firstPipeline.id,
        notes: `Movido do CRM "${sourceBoardName ?? 'outro CRM'}"`,
        ...(userName ? { changed_by: userName } : {}),
      });

      // 5. Arquiva o original e remove links de chat (para não duplicar vínculo ativo)
      const originalCustomFields = (deal.custom_fields ?? {}) as Record<string, unknown>;
      const cleanedCustomFields: Record<string, unknown> = { ...originalCustomFields };
      if (cleanedCustomFields.links) {
        delete cleanedCustomFields.links;
      }

      const { error: archiveErr } = await supabase
        .from('crm_deals')
        .update({
          status: 'archived',
          custom_fields: JSON.parse(JSON.stringify(cleanedCustomFields)),
        })
        .eq('id', deal.id);

      if (archiveErr) {
        // cópia foi criada, mas falhou arquivar — avisa o usuário
        toast({
          title: 'Cópia criada, mas o original não foi arquivado',
          description: `Cópia: ${newDeal.id}. Arquive o original manualmente.`,
          variant: 'destructive',
        });
        return {
          newDealId: newDeal.id,
          newBoardId: newDeal.board_id,
          newPipelineId: newDeal.pipeline_id,
        };
      }

      // 6. Histórico do original (arquivado)
      await supabase.from('crm_deal_history').insert({
        deal_id: deal.id,
        action: 'updated',
        notes: `Card movido para o CRM "${targetBoardName ?? 'outro CRM'}"`,
        ...(userName ? { changed_by: userName } : {}),
      });

      return {
        newDealId: newDeal.id,
        newBoardId: newDeal.board_id,
        newPipelineId: newDeal.pipeline_id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mover card entre quadros';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  }, [toast]);
}
