import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatHistoryConfig {
  history_sync_days: number;
}

const DEFAULT_CONFIG: ChatHistoryConfig = { history_sync_days: 7 };

export function useChatHistoryConfig() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const { data: config = DEFAULT_CONFIG, isLoading } = useQuery({
    queryKey: ['chat-history-config', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ChatHistoryConfig> => {
      if (!clientId) return DEFAULT_CONFIG;
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error || !data) return DEFAULT_CONFIG;
      const s = (data.settings ?? {}) as any;
      return {
        history_sync_days:
          typeof s?.history_sync_days === 'number' && s.history_sync_days > 0
            ? s.history_sync_days
            : DEFAULT_CONFIG.history_sync_days,
      };
    },
    staleTime: 60_000,
  });

  return { config, isLoading };
}
