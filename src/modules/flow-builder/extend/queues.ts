/**
 * extend/queues — filas e membros, para uso nos formulários de nós.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useFlowBuilderIdentity } from './auth';

export interface FlowQueueOption {
  id: string;
  name: string;
  channel_type: string | null;
  is_active: boolean;
}

export function useFlowQueues() {
  const { clientId } = useFlowBuilderIdentity();
  return useQuery<FlowQueueOption[]>({
    queryKey: ['flow-builder', 'queues', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, channel_type, is_active')
        .eq('client_id', clientId)
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return (data || []) as FlowQueueOption[];
    },
    staleTime: 60_000,
  });
}