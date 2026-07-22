import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QueueAgentLinkInfo {
  hasAgent: boolean;
  codAgent: string | null;
  /** Queue hub: 'uazapi' | 'waba' | null (when queue not fetched). */
  hub: string | null;
}

const STALE = 5 * 60_000;

/**
 * Single-queue lookup for queue_agent_links.
 * Returns { hasAgent, codAgent } — codAgent prefers is_primary=true.
 */
export function useQueueAgentLink(queueId: string | null | undefined) {
  return useQuery({
    queryKey: ['queue-agent-link', queueId],
    queryFn: async (): Promise<QueueAgentLinkInfo> => {
      if (!queueId) return { hasAgent: false, codAgent: null, hub: null };
      const { data, error } = await supabase
        .from('queue_agent_links')
        .select('cod_agent, is_primary, queues(hub)')
        .eq('queue_id', queueId);
      if (error) throw error;
      if (!data || data.length === 0) return { hasAgent: false, codAgent: null, hub: null };
      const primary = data.find((r) => r.is_primary) || data[0];
      const hub = (primary as any)?.queues?.hub ?? null;
      return { hasAgent: true, codAgent: primary.cod_agent, hub };
    },
    enabled: !!queueId,
    staleTime: STALE,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Batch lookup. Returns Map<queueId, QueueAgentLinkInfo>.
 * Used by ChatList to avoid N requests.
 */
export function useQueueAgentLinks(queueIds: string[]) {
  const sorted = [...new Set(queueIds.filter(Boolean))].sort();
  const key = sorted.join(',');
  return useQuery({
    queryKey: ['queue-agent-links-batch', key],
    queryFn: async (): Promise<Map<string, QueueAgentLinkInfo>> => {
      const map = new Map<string, QueueAgentLinkInfo>();
      if (sorted.length === 0) return map;
      const { data, error } = await supabase
        .from('queue_agent_links')
        .select('queue_id, cod_agent, is_primary')
        .in('queue_id', sorted);
      if (error) throw error;
      // Group by queue_id, prefer is_primary
      const byQueue = new Map<string, { cod_agent: string; is_primary: boolean }[]>();
      (data || []).forEach((r) => {
        const arr = byQueue.get(r.queue_id) || [];
        arr.push({ cod_agent: r.cod_agent, is_primary: !!r.is_primary });
        byQueue.set(r.queue_id, arr);
      });
      sorted.forEach((qid) => {
        const arr = byQueue.get(qid);
        if (!arr || arr.length === 0) {
          map.set(qid, { hasAgent: false, codAgent: null, hub: null });
        } else {
          const primary = arr.find((x) => x.is_primary) || arr[0];
          map.set(qid, { hasAgent: true, codAgent: primary.cod_agent, hub: null });
        }
      });
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: STALE,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
