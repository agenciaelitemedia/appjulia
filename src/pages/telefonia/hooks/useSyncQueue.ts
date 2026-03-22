import { useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface QueueItem {
  callId: string;
  scheduledAt: number;
  retries: number;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY = 15000;
const RETRY_DELAY = 10000;
const POLL_INTERVAL = 5000;

export function useSyncQueue(codAgent: string | undefined) {
  const queue = useRef<QueueItem[]>([]);
  const processing = useRef(false);
  const queryClient = useQueryClient();

  const processNext = useCallback(async () => {
    if (processing.current || !codAgent) return;

    const now = Date.now();
    const readyIndex = queue.current.findIndex(item => item.scheduledAt <= now);
    if (readyIndex === -1) return;

    processing.current = true;
    const item = queue.current.splice(readyIndex, 1)[0];

    try {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'sync_call_history', codAgent, callId: item.callId },
      });

      if (error || data?.error) {
        console.warn(`Sync failed for ${item.callId}:`, error?.message || data?.error);
        if (item.retries < MAX_RETRIES) {
          queue.current.push({
            callId: item.callId,
            scheduledAt: Date.now() + RETRY_DELAY,
            retries: item.retries + 1,
          });
        }
      } else if (data?.data?.synced === 0 && data?.data?.notFound) {
        // CDR not yet available
        if (item.retries < MAX_RETRIES) {
          queue.current.push({
            callId: item.callId,
            scheduledAt: Date.now() + RETRY_DELAY,
            retries: item.retries + 1,
          });
        }
      } else {
        // Success
        queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
      }
    } catch (err) {
      console.error(`Sync error for ${item.callId}:`, err);
      if (item.retries < MAX_RETRIES) {
        queue.current.push({
          callId: item.callId,
          scheduledAt: Date.now() + RETRY_DELAY,
          retries: item.retries + 1,
        });
      }
    } finally {
      processing.current = false;
    }
  }, [codAgent, queryClient]);

  useEffect(() => {
    const interval = setInterval(processNext, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [processNext]);

  const enqueue = useCallback((callId: string) => {
    // Avoid duplicates
    if (queue.current.some(item => item.callId === callId)) return;
    queue.current.push({ callId, scheduledAt: Date.now() + INITIAL_DELAY, retries: 0 });
  }, []);

  return { enqueue };
}
