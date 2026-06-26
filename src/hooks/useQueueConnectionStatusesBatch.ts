import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Queue } from '@/pages/agente/filas/hooks/useQueues';

/**
 * Batch connection-status check for chat queues.
 *
 * Returns Map<queueId, boolean | null> where:
 *  - true  → connected
 *  - false → disconnected (we know it's offline)
 *  - null  → unknown / not applicable (webchat, instagram, missing creds)
 *
 * Only checks uazapi (via uazapi-instance-manager) and waba (treated as
 * connected when token + number_id are saved). Other channels are skipped
 * to avoid noisy false-positives in the chat list.
 */
export function useQueueConnectionStatusesBatch(queues: Queue[]) {
  const checkable = useMemo(
    () =>
      (queues || []).filter(
        (q) =>
          q.is_active &&
          !q.is_deleted &&
          ((q.channel_type === 'uazapi' && !!q.evo_instance) ||
            (q.channel_type === 'waba' && !!q.waba_token && !!q.waba_number_id)),
      ),
    [queues],
  );

  const queries = useQueries({
    queries: checkable.map((queue) => ({
      queryKey: [
        'chat-queue-conn-status',
        queue.id,
        queue.channel_type,
        queue.evo_instance,
        queue.waba_number_id,
      ],
      queryFn: async (): Promise<{ queueId: string; connected: boolean | null }> => {
        try {
          if (queue.channel_type === 'uazapi' && queue.evo_instance) {
            const { data, error } = await supabase.functions.invoke(
              'uazapi-instance-manager',
              { body: { action: 'status', queue_id: queue.id } },
            );
            if (error || !data?.data) return { queueId: queue.id, connected: false };
            const inst = data.data.instance || data.data;
            const status = data.data.status || data.data;
            const ok = status?.connected === true || inst?.status === 'open';
            return { queueId: queue.id, connected: !!ok };
          }
          if (queue.channel_type === 'waba') {
            return { queueId: queue.id, connected: true };
          }
          return { queueId: queue.id, connected: null };
        } catch {
          return { queueId: queue.id, connected: false };
        }
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 0,
      refetchOnWindowFocus: false,
    })),
  });

  const map = useMemo(() => {
    const m = new Map<string, boolean | null>();
    queries.forEach((q) => {
      if (q.data) m.set(q.data.queueId, q.data.connected);
    });
    return m;
  }, [queries]);

  return { statusMap: map, isLoading: queries.some((q) => q.isLoading) };
}