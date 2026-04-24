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

export interface DispatcherHealth {
  id: string;
  last_seen_at: string;
  workers_active: number;
  workers_max: number;
  items_per_min: number;
  total_processed_session: number;
  started_at: string;
  is_healthy: boolean;
  is_warning: boolean;
  is_offline: boolean;
  seconds_since_heartbeat: number;
}

export function useDispatcherHealth() {
  return useQuery<DispatcherHealth | null>({
    queryKey: ['uazapi-dispatcher-heartbeat'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dispatcher_heartbeat' as never)
        .select('*')
        .eq('id', 'uazapi-history-dispatcher')
        .maybeSingle();
      if (!data) return null;
      const row = data as unknown as Omit<DispatcherHealth, 'is_healthy' | 'is_warning' | 'is_offline' | 'seconds_since_heartbeat'>;
      const seconds = (Date.now() - new Date(row.last_seen_at).getTime()) / 1000;
      return {
        ...row,
        seconds_since_heartbeat: Math.round(seconds),
        is_healthy: seconds < 90,
        is_warning: seconds >= 90 && seconds < 300,
        is_offline: seconds >= 300,
      };
    },
    refetchInterval: 5000,
  });
}

export interface PendingByClient {
  client_id: string;
  client_name: string | null;
  pending_count: number;
  oldest_pending_at: string | null;
}

export function useUazapiPendingByClient() {
  return useQuery<PendingByClient[]>({
    queryKey: ['uazapi-history-pending-by-client'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_history_pending_by_client' as never)
        .select('*');
      if (error) return [];
      return (data ?? []) as unknown as PendingByClient[];
    },
    refetchInterval: 8000,
  });
}

export interface WorkerErrorRow {
  id: string;
  run_id: string;
  remote_jid: string;
  phone: string | null;
  worker_id: number | null;
  attempts: number;
  error: string | null;
  processed_at: string | null;
  locked_at: string | null;
}

export function useUazapiRecentErrors(limit = 50) {
  return useQuery<WorkerErrorRow[]>({
    queryKey: ['uazapi-history-recent-errors', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uazapi_history_items' as never)
        .select('id, run_id, remote_jid, phone, worker_id, attempts, error, processed_at, locked_at')
        .eq('status', 'error')
        .order('processed_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) return [];
      return (data ?? []) as unknown as WorkerErrorRow[];
    },
    refetchInterval: 6000,
  });
}

export interface WorkerStatsRow {
  worker_id: number;
  active_locks: number;
  errors_last_hour: number;
  done_last_hour: number;
  last_activity: string | null;
}

export function useUazapiWorkerStats() {
  return useQuery<WorkerStatsRow[]>({
    queryKey: ['uazapi-history-worker-stats'],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      // active locks (currently held)
      const [{ data: lockedRows }, { data: errorRows }, { data: doneRows }] = await Promise.all([
        supabase
          .from('uazapi_history_items' as never)
          .select('worker_id, locked_at')
          .not('worker_id', 'is', null)
          .not('locked_at', 'is', null)
          .eq('status', 'pending')
          .limit(2000),
        supabase
          .from('uazapi_history_items' as never)
          .select('worker_id, processed_at')
          .eq('status', 'error')
          .gte('processed_at', sinceIso)
          .not('worker_id', 'is', null)
          .limit(5000),
        supabase
          .from('uazapi_history_items' as never)
          .select('worker_id, processed_at')
          .eq('status', 'ok')
          .gte('processed_at', sinceIso)
          .not('worker_id', 'is', null)
          .limit(20000),
      ]);

      const map = new Map<number, WorkerStatsRow>();
      const ensure = (wid: number): WorkerStatsRow => {
        let r = map.get(wid);
        if (!r) {
          r = { worker_id: wid, active_locks: 0, errors_last_hour: 0, done_last_hour: 0, last_activity: null };
          map.set(wid, r);
        }
        return r;
      };

      ((lockedRows ?? []) as Array<{ worker_id: number; locked_at: string | null }>).forEach((r) => {
        const row = ensure(r.worker_id);
        row.active_locks += 1;
        if (r.locked_at && (!row.last_activity || r.locked_at > row.last_activity)) row.last_activity = r.locked_at;
      });
      ((errorRows ?? []) as Array<{ worker_id: number; processed_at: string | null }>).forEach((r) => {
        const row = ensure(r.worker_id);
        row.errors_last_hour += 1;
        if (r.processed_at && (!row.last_activity || r.processed_at > row.last_activity)) row.last_activity = r.processed_at;
      });
      ((doneRows ?? []) as Array<{ worker_id: number; processed_at: string | null }>).forEach((r) => {
        const row = ensure(r.worker_id);
        row.done_last_hour += 1;
        if (r.processed_at && (!row.last_activity || r.processed_at > row.last_activity)) row.last_activity = r.processed_at;
      });

      return Array.from(map.values()).sort((a, b) => a.worker_id - b.worker_id);
    },
    refetchInterval: 7000,
  });
}

export interface ThroughputPoint {
  bucket: string; // ISO minute
  ok_count: number;
  error_count: number;
}

export function useUazapiThroughput(minutes = 30) {
  return useQuery<ThroughputPoint[]>({
    queryKey: ['uazapi-history-throughput', minutes],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('uazapi_history_items' as never)
        .select('processed_at, status')
        .in('status', ['ok', 'error'])
        .gte('processed_at', sinceIso)
        .order('processed_at', { ascending: true })
        .limit(20000);

      const buckets = new Map<string, ThroughputPoint>();
      ((data ?? []) as Array<{ processed_at: string | null; status: string }>).forEach((r) => {
        if (!r.processed_at) return;
        const d = new Date(r.processed_at);
        d.setSeconds(0, 0);
        const key = d.toISOString();
        let p = buckets.get(key);
        if (!p) {
          p = { bucket: key, ok_count: 0, error_count: 0 };
          buckets.set(key, p);
        }
        if (r.status === 'ok') p.ok_count += 1;
        else if (r.status === 'error') p.error_count += 1;
      });
      return Array.from(buckets.values());
    },
    refetchInterval: 10000,
  });
}