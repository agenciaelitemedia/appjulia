import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type WavoipReconcileJob = {
  id: string;
  whatsapp_call_id: string;
  run_after: string;
  attempts: number;
  status: 'pending' | 'running' | 'done' | 'error';
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function nextMinuteCeiling(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  return next;
}

export function useWavoipReconcileQueue(clientId: number | null) {
  const qc = useQueryClient();
  const key = ['wavoip-reconcile-queue', clientId];

  const query = useQuery({
    queryKey: key,
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_reconcile_queue')
        .select('*')
        .eq('status', 'pending')
        .order('run_after', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WavoipReconcileJob[];
    },
  });

  const pending = query.data ?? [];
  const hasPending = pending.length > 0;
  const nextRunAt = useMemo(() => {
    if (!hasPending) return null;
    const earliest = pending[0]?.run_after ? new Date(pending[0].run_after) : null;
    const now = new Date();
    // Cron runs every minute; estimate next run as the soonest of earliest pending or next minute.
    const cronNext = nextMinuteCeiling(now);
    if (earliest && earliest > now) return earliest;
    return cronNext;
  }, [pending, hasPending]);

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`wavoip-reconcile-queue-${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wavoip_reconcile_queue' },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, qc, key]);

  return {
    ...query,
    pending,
    hasPending,
    count: pending.length,
    nextRunAt,
  };
}
