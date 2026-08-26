import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { DspAuditRow } from '../types';

export interface DspLogFilters {
  campaignId?: string | null;
  queueId?: string | null;
  action?: string | null;
  days?: number;
}

/** Logs detalhados por campanha e por fila (dsp_audit_log). */
export function useDspLogs(clientId: string | null, filters: DspLogFilters) {
  return useQuery<DspAuditRow[]>({
    queryKey: ['disparos', 'logs', clientId, filters],
    enabled: !!clientId,
    refetchInterval: 15_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_audit_log')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false })
        .limit(300);

      if (filters.campaignId) q = q.eq('campaign_id', filters.campaignId);
      if (filters.queueId) q = q.eq('queue_id', filters.queueId);
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.days) {
        q = q.gte('created_at', new Date(Date.now() - filters.days * 86400_000).toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspAuditRow[];
    },
  });
}

/** Destinatários com falha, para diagnóstico por campanha. */
export function useDspFailedRecipients(clientId: string | null, campaignId?: string | null) {
  return useQuery({
    queryKey: ['disparos', 'failed-recipients', clientId, campaignId ?? 'all'],
    enabled: !!clientId,
    refetchInterval: 20_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_recipients')
        .select('id, phone_e164, name, status, exclusion_reason, error_message, attempts, queue_id, failed_at, sent_at')
        .eq('client_id', String(clientId))
        .in('status', ['failed'])
        .order('failed_at', { ascending: false })
        .limit(100);
      if (campaignId) q = q.eq('campaign_id', campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
