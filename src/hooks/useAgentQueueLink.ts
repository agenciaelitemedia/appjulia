import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentQueueLinkInfo {
  source: 'queue' | 'direct';
  queueId: string | null;
  queueName: string | null;
  channelType: string | null;
  /** Queue's connection hub: 'uazapi' | 'waba' | etc. Null when source='direct'. */
  hub: string | null;
  /** UaZapi base URL of the queue (when channel_type='whatsapp' + hub='uazapi'). */
  evoUrl: string | null;
  /** UaZapi API token of the queue. */
  evoApikey: string | null;
  /** UaZapi instance name of the queue. */
  evoInstance: string | null;
  /** WABA Business ID of the queue. */
  wabaId: string | null;
  /** WABA phone_number_id of the queue. */
  wabaNumberId: string | null;
  /** WABA permanent token of the queue. */
  wabaToken: string | null;
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
      const empty: AgentQueueLinkInfo = {
        source: 'direct',
        queueId: null,
        queueName: null,
        channelType: null,
        hub: null,
        evoUrl: null,
        evoApikey: null,
        evoInstance: null,
        wabaId: null,
        wabaNumberId: null,
        wabaToken: null,
      };
      if (!codAgent) return empty;

      const { data, error } = await supabase
        .from('queue_agent_links')
        .select('queue_id, is_primary, queues!inner(id, name, channel_type, hub, evo_url, evo_apikey, evo_instance, waba_id, waba_number_id, waba_token, is_active, is_deleted)')
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
        return empty;
      }

      const primary = valid.find((r) => r.is_primary) || valid[0];
      const q = primary.queue as any;
      return {
        source: 'queue',
        queueId: primary.queue_id,
        queueName: q?.name ?? null,
        channelType: q?.channel_type ?? null,
        hub: q?.hub ?? null,
        evoUrl: q?.evo_url ?? null,
        evoApikey: q?.evo_apikey ?? null,
        evoInstance: q?.evo_instance ?? null,
        wabaId: q?.waba_id ?? null,
        wabaNumberId: q?.waba_number_id ?? null,
        wabaToken: q?.waba_token ?? null,
      };
    },
  });
}