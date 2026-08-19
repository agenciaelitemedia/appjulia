import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { AlertHistoryEntry, AlertHistoryFilters } from '../types';

const TABLE = 'alert_notification_logs';

/** Auditoria completa de alertas disparados (uso restrito a admin na UI). */
export function useAlertHistory(filters: AlertHistoryFilters, enabled = true) {
  return useQuery({
    queryKey: ['alerts', 'history', filters],
    enabled,
    queryFn: async () => {
      let query = (supabase as any)
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (filters.codAgent) query = query.eq('cod_agent', filters.codAgent);
      if (filters.triggerKey) query = query.eq('trigger_key', filters.triggerKey);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `lead_phone.ilike.${term},lead_name.ilike.${term},recipient_phone.ilike.${term}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AlertHistoryEntry[];
    },
  });
}
