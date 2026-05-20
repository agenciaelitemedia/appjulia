import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_AUTOMATION_FLAGS,
  type AgentAutomationFlags,
} from '@/lib/agentSettings';

/**
 * Returns automation flags for the logged-in user's client_id.
 * Source: `chat_client_settings.settings` (per-client config managed in
 * /admin/chat → "Inteligência de Atendimento"). Missing flags default to false.
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
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      const s = (data?.settings ?? {}) as Record<string, unknown>;
      return {
        autoTranscribeAudio: Boolean(s.auto_transcribe_audio ?? false),
        autoSummaryOnResolve: Boolean(s.auto_summary_on_resolve ?? false),
        autoSummaryOnClose: Boolean(s.auto_summary_on_close ?? false),
        usingAudio: Boolean(s.using_audio ?? false),
      };
    },
  });

  return {
    flags: query.data ?? { ...DEFAULT_AUTOMATION_FLAGS },
    isLoading: query.isLoading,
  };
}