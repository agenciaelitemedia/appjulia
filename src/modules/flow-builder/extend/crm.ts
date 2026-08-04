/**
 * extend/crm — quadros e fases do CRM Builder, para os nós de CRM.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useFlowBuilderIdentity } from './auth';

export interface FlowBoardOption {
  id: string;
  name: string;
}

export function useFlowBoards() {
  const { clientId } = useFlowBuilderIdentity();
  return useQuery<FlowBoardOption[]>({
    queryKey: ['flow-builder', 'crm-boards', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_boards')
        .select('id, name')
        .eq('client_id', clientId)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as FlowBoardOption[];
    },
    staleTime: 60_000,
  });
}

export interface FlowStageOption {
  id: string;
  name: string;
  board_id: string;
}

/** Fases (pipelines) de um quadro do CRM Builder. */
export function useFlowStages(boardId?: string | null) {
  const { clientId } = useFlowBuilderIdentity();
  return useQuery<FlowStageOption[]>({
    queryKey: ['flow-builder', 'crm-stages', clientId, boardId ?? 'none'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('id, name, board_id')
        .eq('client_id', clientId)
        .eq('board_id', boardId as string)
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as FlowStageOption[];
    },
    enabled: Boolean(boardId),
    staleTime: 60_000,
  });
}