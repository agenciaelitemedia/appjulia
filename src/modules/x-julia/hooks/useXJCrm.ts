import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJDeal, XJPipeline } from '../types';
import { xjInvoke } from '../lib/xjInvoke';

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
/** Sincroniza (e cria, se necessário) o quadro "CRM da Julia" no CRM Builder. */
export function useXJSyncCrmBuilder() {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  return useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('escritório não identificado');
      const { data, error } = await xjInvoke('x-julia-admin', {
        body: { action: 'crm_sync_builder', data: { client_id: String(clientId) } },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        board_id: string;
        total: number;
        created: number;
        updated: number;
        moved: number;
        errors: string[];
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['x-julia', 'deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-boards'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success(
        `Sincronizado: ${result.created} criado(s), ${result.updated} atualizado(s), ${result.moved} movido(s)`,
      );
      if (result.errors?.length) toast.warning(`${result.errors.length} card(s) com falha`);
    },
    onError: (e: any) => toast.error(`Falha ao sincronizar: ${e.message}`),
  });
}
