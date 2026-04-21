import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatHistoryConfig {
  history_sync_days: number;
}

const DEFAULT_CONFIG: ChatHistoryConfig = { history_sync_days: 7 };

export function useChatHistoryConfig() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;
  const queryClient = useQueryClient();

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

  const save = useMutation({
    mutationFn: async (days: number) => {
      if (!clientId) throw new Error('Cliente não identificado');
      // Read current settings first to preserve other keys
      const { data: existing } = await supabase
        .from('chat_client_settings')
        .select('id, settings')
        .eq('client_id', clientId)
        .maybeSingle();
      const currentSettings = (existing?.settings ?? {}) as Record<string, unknown>;
      const { error } = await supabase
        .from('chat_client_settings')
        .upsert(
          { client_id: clientId, settings: { ...currentSettings, history_sync_days: days } },
          { onConflict: 'client_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history-config', clientId] });
      toast.success('Configuração salva');
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  return { config, isLoading, save };
}
