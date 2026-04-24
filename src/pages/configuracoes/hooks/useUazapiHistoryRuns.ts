import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UazapiHistoryRun {
  id: string;
  client_id: string;
  client_name: string | null;
  queue_id: string | null;
  queue_name: string | null;
  event: string;
  status: 'pending' | 'running' | 'done' | 'partial' | 'error';
  total_messages: number;
  group_messages: number;
  individual_chats: number;
  processed_chats: number;
  inserted_messages: number;
  duplicate_messages: number;
  inserted_contacts: number;
  skipped_lid: number;
  error: string | null;
  received_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface UazapiHistoryItem {
  id: string;
  run_id: string;
  remote_jid: string;
  phone: string | null;
  status: 'pending' | 'ok' | 'skipped' | 'error';
  received_messages: number;
  inserted_messages: number;
  duplicate_messages: number;
  contact_created: boolean;
  conversation_created: boolean;
  skipped_lid: number;
  error: string | null;
  processed_at: string | null;
}

export function useUazapiHistoryRuns() {
  return useQuery<UazapiHistoryRun[]>({
    queryKey: ['uazapi-history-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_history_runs' as never)
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as UazapiHistoryRun[];
    },
    refetchInterval: (query) => {
      const runs = query.state.data as UazapiHistoryRun[] | undefined;
      const active = runs?.some((r) => r.status === 'pending' || r.status === 'running');
      return active ? 4000 : 10000;
    },
  });
}

export function useUazapiHistoryItems(runId: string | null) {
  return useQuery<UazapiHistoryItem[]>({
    queryKey: ['uazapi-history-items', runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_history_items' as never)
        .select('*')
        .eq('run_id', runId!)
        .order('processed_at', { ascending: false, nullsFirst: false })
        .order('remote_jid', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as UazapiHistoryItem[];
    },
    refetchInterval: 4000,
  });
}