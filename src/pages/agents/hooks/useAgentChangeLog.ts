import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ChangeLogEntry {
  agent_id: number;
  changed_by: string | null;
  created_at: string;
}

export type AgentLastChangeMap = Map<number, { changed_by: string | null; created_at: string }>;

export async function insertAgentChangeLog(params: {
  agent_id: number;
  cod_agent: string;
  action: 'create' | 'update' | 'status_change';
  changed_by?: string;
  changed_by_id?: number;
  change_summary?: string;
  snapshot?: Record<string, unknown>;
  changes?: Record<string, unknown>;
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('agent_change_log').insert([{
      agent_id: params.agent_id,
      cod_agent: params.cod_agent,
      action: params.action,
      changed_by: params.changed_by || null,
      changed_by_id: params.changed_by_id || null,
      change_summary: params.change_summary || null,
      snapshot: (params.snapshot || null) as any,
      changes: (params.changes || null) as any,
    }]);
    if (error) {
      console.error('Failed to insert agent change log:', error.message, error.details, error.hint);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err) {
    console.error('Exception inserting agent change log:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export function useAgentsLastChanges(agentIds: number[]) {
  return useQuery({
    queryKey: ['agents-last-changes', agentIds.sort().join(',')],
    queryFn: async (): Promise<AgentLastChangeMap> => {
      if (agentIds.length === 0) return new Map();

      // Fetch latest change per agent using order + distinct logic client-side
      const { data, error } = await supabase
        .from('agent_change_log')
        .select('agent_id, changed_by, created_at')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch agent changes:', error);
        return new Map();
      }

      // Keep only the latest per agent_id
      const map: AgentLastChangeMap = new Map();
      for (const row of (data as ChangeLogEntry[])) {
        if (!map.has(row.agent_id)) {
          map.set(row.agent_id, { changed_by: row.changed_by, created_at: row.created_at });
        }
      }
      return map;
    },
    staleTime: 30000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    enabled: agentIds.length > 0,
  });
}
