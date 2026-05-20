import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_AUTOMATION_FLAGS,
  type AgentAutomationFlags,
} from '@/lib/agentSettings';

/**
 * Returns consolidated automation flags for the logged-in user's client_id.
 * A flag is `true` if ANY agent under that client has it enabled in
 * `agents.settings`. Missing flags default to `false`.
 */
export function useClientAutomationFlags() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const query = useQuery({
    queryKey: ['client-automation-flags', clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<AgentAutomationFlags> => {
      if (!clientId) return { ...DEFAULT_AUTOMATION_FLAGS };
      const { data, error } = await supabase.functions.invoke(
        'client-automation-flags',
        { body: { client_id: clientId } },
      );
      if (error) throw error;
      return {
        autoTranscribeAudio: !!data?.autoTranscribeAudio,
        autoSummaryOnResolve: !!data?.autoSummaryOnResolve,
        autoSummaryOnClose: !!data?.autoSummaryOnClose,
        usingAudio: !!data?.usingAudio,
      };
    },
  });

  return {
    flags: query.data ?? { ...DEFAULT_AUTOMATION_FLAGS },
    isLoading: query.isLoading,
  };
}