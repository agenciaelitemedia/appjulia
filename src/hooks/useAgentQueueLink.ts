import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentQueueLinkInfo {
  source: 'queue' | 'direct';
  queueId: string | null;
  queueName: string | null;
  channelType: string | null;
}

/**
 * Looks up whether a given cod_agent is bound to a queue (queue_agent_links → queues).
 * Returns { source: 'queue', queueName } when linked to an active, non-deleted queue.
 * Returns { source: 'direct' } when there's no queue link (agent uses its own UaZapi creds).
 */
export function useAgentQueueLink(codAgent: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['agent-queue-link', codAgent],
    enabled: !!codAgent && enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AgentQueueLinkInfo> => {
      if (!codAgent) return { source: 'direct', queueId: null, queueName: null, channelType: null };

      const { data, error } = await supabase
        .from('queue_agent_links')
        .select('queue_id, is_primary, queues!inner(id, name, channel_type, is_active, is_deleted)')
        .eq('cod_agent', codAgent);

      if (error) throw error;

      const valid = (data || [])
        .map((r: any) => ({
          queue_id: r.queue_id as string,
          is_primary: !!r.is_primary,
          queue: r.queues,
        }))
        .filter((r) => r.queue && r.queue.is_active === true && r.queue.is_deleted !== true);

      if (valid.length === 0) {
        return { source: 'direct', queueId: null, queueName: null, channelType: null };
      }

      const primary = valid.find((r) => r.is_primary) || valid[0];
      return {
        source: 'queue',
        queueId: primary.queue_id,
        queueName: primary.queue?.name ?? null,
        channelType: primary.queue?.channel_type ?? null,
      };
    },
  });
}