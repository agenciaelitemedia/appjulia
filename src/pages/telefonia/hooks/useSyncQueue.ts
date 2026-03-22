import { useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncQueueManager } from '@/lib/syncQueueManager';

export function useSyncQueue(codAgent: string | undefined) {
  const queryClient = useQueryClient();

  // Init the global manager with codAgent
  useEffect(() => {
    if (codAgent) syncQueueManager.init(codAgent);
  }, [codAgent]);

  // Listen for sync-queue-done events
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
    };
    window.addEventListener('sync-queue-done', handler);
    return () => window.removeEventListener('sync-queue-done', handler);
  }, [queryClient]);

  const enqueue = useCallback((callId: string) => {
    syncQueueManager.enqueue(callId);
  }, []);

  return { enqueue };
}
