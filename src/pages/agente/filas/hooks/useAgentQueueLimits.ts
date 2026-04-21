import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentQueueLimits {
  queueLimit: number;
  allowGroups: boolean;
}

const DEFAULTS: AgentQueueLimits = { queueLimit: 1, allowGroups: false };

/**
 * Returns the queue-related settings of the currently logged-in user's agent.
 * Falls back to defaults (1 queue, no groups) when no agent is associated.
 */
export function useAgentQueueLimits() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return useQuery({
    queryKey: ['agent-queue-limits', clientId],
    queryFn: async (): Promise<AgentQueueLimits> => {
      if (!clientId) return DEFAULTS;
      try {
        const rows = await externalDb.raw<{ settings: unknown }>({
          query: `SELECT settings FROM agents WHERE client_id = $1 ORDER BY id ASC LIMIT 1`,
          params: [clientId],
        });
        if (!rows.length) return DEFAULTS;
        let s: any = rows[0].settings;
        if (typeof s === 'string') {
          try { s = JSON.parse(s); } catch { s = {}; }
        }
        return {
          queueLimit: typeof s?.QUEUE_LIMIT === 'number' && s.QUEUE_LIMIT > 0 ? s.QUEUE_LIMIT : 1,
          allowGroups: !!s?.ALLOW_GROUPS,
        };
      } catch {
        return DEFAULTS;
      }
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}