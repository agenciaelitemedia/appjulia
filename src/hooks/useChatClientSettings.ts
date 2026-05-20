import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatClientSettings {
  return_chat_enabled: boolean;
  return_chat_tolerance_minutes: number;
  auto_transcribe_audio: boolean;
  auto_summary_on_resolve: boolean;
  auto_summary_on_close: boolean;
}

const DEFAULTS: ChatClientSettings = {
  return_chat_enabled: false,
  return_chat_tolerance_minutes: 0,
  auto_transcribe_audio: false,
  auto_summary_on_resolve: false,
  auto_summary_on_close: false,
};

export function useChatClientSettings() {
  const { user } = useAuth();
  const clientId = String(user?.client_id ?? user?.id ?? '');
  const queryClient = useQueryClient();

  const { data: settings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['chat-client-settings', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ChatClientSettings> => {
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.settings) return DEFAULTS;
      const s = data.settings as Record<string, unknown>;
      return {
        return_chat_enabled: Boolean(s.return_chat_enabled ?? false),
        return_chat_tolerance_minutes: Number(s.return_chat_tolerance_minutes ?? 0),
        auto_transcribe_audio: Boolean(s.auto_transcribe_audio ?? false),
        auto_summary_on_resolve: Boolean(s.auto_summary_on_resolve ?? false),
        auto_summary_on_close: Boolean(s.auto_summary_on_close ?? false),
      };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<ChatClientSettings>) => {
      // Read current raw settings first to preserve unrelated keys
      const { data: current } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();

      const existing = (current?.settings as Record<string, unknown>) ?? {};
      const merged = { ...existing, ...patch };

      const { error } = await supabase
        .from('chat_client_settings')
        .upsert({ client_id: clientId, settings: merged }, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-client-settings', clientId] });
      toast.success('Configuração salva');
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  return { settings, isLoading, update };
}
