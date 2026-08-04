import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';

export interface FlowRunLog {
  node_id: string;
  kind: string;
  label: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  branch?: string;
  at: string;
}

export interface FlowRunRecord {
  id: string;
  status: string;
  trigger_event: string | null;
  error_message: string | null;
  is_simulation: boolean;
  started_at: string;
  finished_at: string | null;
  conversation_id: string | null;
  node_logs: FlowRunLog[];
}

export function useFlowRuns(flowId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['flow-builder-runs', flowId],
    enabled: !!flowId && options?.enabled !== false,
    refetchInterval: options?.enabled === false ? false : 20_000,
    queryFn: async (): Promise<FlowRunRecord[]> => {
      const { data, error } = await supabase
        .from('chat_bot_flow_runs')
        .select('id, status, trigger_event, error_message, is_simulation, started_at, finished_at, conversation_id, node_logs')
        .eq('flow_id', flowId)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        status: String(row.status ?? 'running'),
        trigger_event: (row.trigger_event as string) ?? null,
        error_message: (row.error_message as string) ?? null,
        is_simulation: Boolean(row.is_simulation),
        started_at: String(row.started_at ?? ''),
        finished_at: (row.finished_at as string) ?? null,
        conversation_id: (row.conversation_id as string) ?? null,
        node_logs: Array.isArray(row.node_logs) ? (row.node_logs as FlowRunLog[]) : [],
      }));
    },
  });
}
