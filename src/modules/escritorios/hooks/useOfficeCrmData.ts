import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { CRMDeal, CRMPipeline } from '../extend/crm';

/** Fases (pipelines) de um ou de todos os quadros do escritório. */
export function useOfficeCrmPipelines(clientId: string | null, boardIds: string[]) {
  const key = [...boardIds].sort().join(',');
  return useQuery<CRMPipeline[]>({
    queryKey: ['escritorios', 'crm-pipelines', clientId, key],
    enabled: !!clientId && boardIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('*')
        .in('board_id', boardIds)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as CRMPipeline[]) || [];
    },
  });
}

/** Cards (deals) de um ou de todos os quadros do escritório. */
export function useOfficeCrmDeals(clientId: string | null, boardIds: string[]) {
  const key = [...boardIds].sort().join(',');
  return useQuery<CRMDeal[]>({
    queryKey: ['escritorios', 'crm-deals', clientId, key],
    enabled: !!clientId && boardIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select(
          'id, board_id, pipeline_id, position, title, value, currency, priority, status, ' +
            'contact_name, assigned_to, stage_entered_at, created_at, updated_at, cod_agent, client_id',
        )
        .in('board_id', boardIds)
        .limit(5000);
      if (error) throw error;
      return (data as unknown as CRMDeal[]) || [];
    },
  });
}