import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AgentQueueInfo {
  queue_id: string;
  queue_name: string;
  channel_type: string;
  is_primary: boolean;
}

export function useAgentQueues(codAgent: string) {
  return useQuery({
    queryKey: ['agent-queues', codAgent],
    queryFn: async (): Promise<AgentQueueInfo[]> => {
      const { data, error } = await supabase
        .from('queue_agent_links')
        .select('queue_id, is_primary, queues(id, name, channel_type)')
        .eq('cod_agent', codAgent);

      if (error) throw error;
      if (!data) return [];

      return data
        .filter((d: any) => d.queues)
        .map((d: any) => ({
          queue_id: d.queue_id,
          queue_name: d.queues.name,
          channel_type: d.queues.channel_type,
          is_primary: d.is_primary,
        }));
    },
    enabled: !!codAgent,
    staleTime: 60000,
  });
}
