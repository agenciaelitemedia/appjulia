import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentQueueLimits {
  queueLimit: number;
  allowGroups: boolean;
}

const DEFAULTS: AgentQueueLimits = { queueLimit: 1, allowGroups: false };

/**
 * Returns the chat-related limits for the currently logged-in user's client.
 * Reads from `chat_client_settings` (Supabase). Falls back to defaults
 * (1 queue, no groups) when no configuration exists for the client.
 */
export function useAgentQueueLimits() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return useQuery({
    queryKey: ['agent-queue-limits', clientId],
    queryFn: async (): Promise<AgentQueueLimits> => {
      if (!clientId) return DEFAULTS;
      try {
        const { data, error } = await supabase
          .from('chat_client_settings')
          .select('settings')
          .eq('client_id', clientId)
          .maybeSingle();
        if (error || !data) return DEFAULTS;
        const s = (data.settings ?? {}) as any;
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
