/**
 * extend/queues — filas do tenant, para vincular ao agente X-Julia.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';
import { useXJClientId } from './auth';

export interface XJQueueOption {
  id: string;
  name: string;
  channel_type: string | null;
  is_active: boolean;
  phone_number: string | null;
}

export function useXJQueues() {
  const { data: clientId } = useXJClientId();
  return useQuery<XJQueueOption[]>({
    queryKey: ['x-julia', 'queues', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, channel_type, is_active, phone_number')
        .eq('client_id', String(clientId))
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return (data || []) as XJQueueOption[];
    },
  });
}