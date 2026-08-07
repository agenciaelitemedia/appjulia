import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJDeal, XJPipeline } from '../types';

export function useXJPipelines() {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJPipeline[]>({
    queryKey: ['x-julia', 'pipelines', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_pipelines')
        .select('*')
        .eq('client_id', String(clientId))
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as XJPipeline[];
    },
  });
}

export function useXJDeals() {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJDeal[]>({
    queryKey: ['x-julia', 'deals', clientId],
    enabled: !!clientId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_deals')
        .select('*')
        .eq('client_id', String(clientId))
        .order('position')
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as XJDeal[];
    },
  });
}

export function useXJDealActions() {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const move = useMutation({
    mutationFn: async ({ dealId, pipelineId, fromPipelineId }: { dealId: string; pipelineId: string; fromPipelineId: string | null }) => {
      const { error } = await supabase
        .from('xj_deals')
        .update({ pipeline_id: pipelineId, stage_entered_at: new Date().toISOString(), updated_by: 'painel' })
        .eq('id', dealId);
      if (error) throw error;
      if (clientId) {
        await supabase.from('xj_deal_history').insert({
          client_id: String(clientId),
          deal_id: dealId,
          from_pipeline_id: fromPipelineId,
          to_pipeline_id: pipelineId,
          action: 'moved',
          actor: 'painel',
        } as any);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'deals'] }),
    onError: (e: any) => toast.error(`Falha ao mover card: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJDeal> }) => {
      const { error } = await supabase.from('xj_deals').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['x-julia', 'deals'] });
      toast.success('Card atualizado');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['x-julia', 'deals'] });
      toast.success('Card removido');
    },
  });

  return { move, update, remove };
}