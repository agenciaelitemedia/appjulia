/**
 * extend/queues — filas/instâncias do tenant usadas como canais de disparo.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './db';

export interface DspQueueOption {
  id: string;
  name: string;
  channel_type: string | null;
  hub: string | null;
  is_active: boolean;
  phone_number: string | null;
}

/** true quando a fila usa API não oficial (risco de bloqueio). */
export function isUnofficialQueue(q: Pick<DspQueueOption, 'channel_type' | 'hub'> | null | undefined): boolean {
  const hub = String(q?.hub ?? '').toLowerCase();
  const ch = String(q?.channel_type ?? '').toLowerCase();
  if (hub.includes('waba') || hub.includes('meta') || hub.includes('cloud')) return false;
  if (ch.includes('waba') || ch.includes('official') || ch.includes('oficial')) return false;
  return true;
}

export function useDspQueues(clientId: string | null) {
  return useQuery<DspQueueOption[]>({
    queryKey: ['disparos', 'queues', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, channel_type, hub, is_active, phone_number')
        .eq('client_id', String(clientId))
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return (data || []) as DspQueueOption[];
    },
  });
}
