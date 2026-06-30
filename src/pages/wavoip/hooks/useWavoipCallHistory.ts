import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type WavoipCall = {
  id: string;
  client_id: number | null;
  app_user_id: number | null;
  device_id: string | null;
  direction: string;
  status: string;
  from_number: string | null;
  to_number: string | null;
  whatsapp_jid: string | null;
  whatsapp_call_id: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  end_reason: string | null;
  recording_url: string | null;
  recording_status: string;
  recording_downloaded_at: string | null;
  created_at: string;
};

export function useWavoipCallHistory(clientId: number | null, appUserId: number | null, opts?: { ownOnly?: boolean }) {
  const qc = useQueryClient();
  const key = ['wavoip-call-history', clientId, opts?.ownOnly ? appUserId : 'all'];

  const query = useQuery({
    queryKey: key,
    enabled: !!clientId,
    queryFn: async () => {
      let q = (supabase as any).from('wavoip_call_logs')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(500);
      if (opts?.ownOnly && appUserId != null) q = q.eq('app_user_id', appUserId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WavoipCall[];
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`wavoip-call-logs-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wavoip_call_logs', filter: `client_id=eq.${clientId}` }, () => {
        qc.invalidateQueries({ queryKey: ['wavoip-call-history', clientId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, qc]);

  return query;
}