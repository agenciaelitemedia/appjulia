/**
 * Devolução do excedente de atendimentos à fila (respeita o teto por atendente).
 * Regra e cálculo ficam no servidor (`chat-rebalance-overflow`).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RebalanceAgent {
  agent_identifier: string;
  agent_name: string | null;
  load: number;
  max_concurrent: number;
  overflow: number;
  candidates: number;
  returned: number;
}

export interface RebalanceResult {
  batch_id: string;
  action: 'preview' | 'commit';
  agents: RebalanceAgent[];
  total_overflow: number;
  total_candidates: number;
  total_returned: number;
}

export interface RebalanceParams {
  client_id: string;
  actor_name?: string | null;
  actor_user_id?: number | null;
  agent_identifier?: string | null;
  min_idle_hours?: number;
}

async function invoke(action: 'preview' | 'commit', params: RebalanceParams): Promise<RebalanceResult> {
  const { data, error } = await supabase.functions.invoke('chat-rebalance-overflow', {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  return data as RebalanceResult;
}

export function useRebalanceOverflow() {
  const qc = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: (p: RebalanceParams) => invoke('preview', p),
  });

  const commitMutation = useMutation({
    mutationFn: (p: RebalanceParams) => invoke('commit', p),
    onSuccess: () => {
      for (const key of [
        ['chat-conversations'],
        ['chat-conversation-list'],
        ['conversations'],
        ['chat-list-feed'],
        ['chat-assigned-counts'],
        ['chat-assigned-counts-by-member'],
        ['chat-agent-capacity-load'],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });

  return { previewMutation, commitMutation };
}
