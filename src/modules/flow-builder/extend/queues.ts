/**
 * extend/queues — filas e membros, para uso nos formulários de nós.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useFlowBuilderIdentity } from './auth';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';

export interface FlowQueueOption {
  id: string;
  name: string;
  channel_type: string | null;
  is_active: boolean;
}

export function useFlowQueues() {
  const { user } = useFlowBuilderIdentity();
  return useQuery<FlowQueueOption[]>({
    queryKey: ['flow-builder', 'queues', user?.id, user?.client_id],
    enabled: !!user?.id,
    queryFn: async () => {
      const clientId = await resolveEffectiveClientId(user, 'flow-builder');
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, channel_type, is_active')
        .eq('client_id', String(clientId))
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return (data || []) as FlowQueueOption[];
    },
    staleTime: 60_000,
  });
}