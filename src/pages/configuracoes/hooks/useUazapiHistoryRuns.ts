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

export interface UazapiHistoryPending {
  pending: number;
  oldest_pending_at: string | null;
}

export function useUazapiHistoryPending() {
  return useQuery<UazapiHistoryPending>({
    queryKey: ['uazapi-history-pending'],
    queryFn: async () => {
      const { count } = await supabase
        .from('uazapi_history_items' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      let oldest: string | null = null;
      if ((count ?? 0) > 0) {
        const { data } = await supabase
          .from('uazapi_history_items' as never)
          .select('created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        oldest = (data as { created_at?: string } | null)?.created_at ?? null;
      }
      return { pending: count ?? 0, oldest_pending_at: oldest };
    },
    refetchInterval: 5000,
  });
}

export interface UazapiQueueOption {
  id: string;
  name: string;
  client_id: string;
  evo_instance: string | null;
}

export function useUazapiQueues() {
  return useQuery<UazapiQueueOption[]>({
    queryKey: ['uazapi-queues-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, client_id, evo_instance')
        .eq('channel_type', 'uazapi')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as UazapiQueueOption[];
    },
  });
}