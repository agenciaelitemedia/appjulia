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
  duration_ms?: number;
  variables?: Record<string, unknown>;
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
  /** Duração total da execução em milissegundos (quando finalizada). */
  duration_ms: number | null;
  variables: Record<string, unknown>;
}

export interface FlowRunFilters {
  /** 'all' | 'completed' | 'running' | 'waiting' | 'failed' */
  status?: string;
  /** 'all' | 'real' | 'simulation' */
  mode?: string;
  /** Janela de tempo em horas; 0 = sem limite. */
  hours?: number;
  /** Busca por evento, erro ou nome de bloco. */
  search?: string;
}

export function useFlowRuns(flowId?: string, options?: { enabled?: boolean; filters?: FlowRunFilters }) {
  const filters = options?.filters ?? {};
  return useQuery({
    queryKey: ['flow-builder-runs', flowId, filters.status, filters.mode, filters.hours],
    enabled: !!flowId && options?.enabled !== false,
    refetchInterval: options?.enabled === false ? false : 20_000,
    queryFn: async (): Promise<FlowRunRecord[]> => {
      let query = supabase
        .from('chat_bot_flow_runs')
        .select('id, status, trigger_event, error_message, is_simulation, started_at, finished_at, conversation_id, node_logs')
        .eq('flow_id', flowId);

      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.mode === 'real') query = query.eq('is_simulation', false);
      if (filters.mode === 'simulation') query = query.eq('is_simulation', true);
      if (filters.hours && filters.hours > 0) {
        query = query.gte('started_at', new Date(Date.now() - filters.hours * 3_600_000).toISOString());
      }

      const { data, error } = await query.order('started_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const startedAt = String(row.started_at ?? '');
        const finishedAt = (row.finished_at as string) ?? null;
        const logs = Array.isArray(row.node_logs) ? (row.node_logs as FlowRunLog[]) : [];
        return {
          id: String(row.id),
          status: String(row.status ?? 'running'),
          trigger_event: (row.trigger_event as string) ?? null,
          error_message: (row.error_message as string) ?? null,
          is_simulation: Boolean(row.is_simulation),
          started_at: startedAt,
          finished_at: finishedAt,
          conversation_id: (row.conversation_id as string) ?? null,
          node_logs: logs,
          duration_ms:
            startedAt && finishedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : null,
          variables: (logs[logs.length - 1]?.variables ?? {}) as Record<string, unknown>,
        };
      });
    },
  });
}
