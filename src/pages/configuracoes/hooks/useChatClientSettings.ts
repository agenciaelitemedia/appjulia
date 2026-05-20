import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatClientSettingsJson {
  QUEUE_LIMIT: number;
  ALLOW_GROUPS: boolean;
  SHOW_GROUPS_TAB?: boolean;
  AUTO_ASSIGN_ON_REPLY?: boolean;
  BUSINESS_HOURS_BLOCK?: boolean;
  QUICK_REPLIES_ENABLED?: boolean;
  READ_RECEIPTS?: boolean;
  TYPING_INDICATOR?: boolean;
  AUTO_RESUME_AFTER_HOURS?: number;
  MAX_FILE_SIZE_MB?: number;
  NOTIFICATION_SOUND?: boolean;
  SHOW_INTERNAL_NOTES?: boolean;
  history_sync_days?: number;
  // Master flags (admin only) — liberam o uso das funcionalidades para o client_id.
  // O dono do escritório precisa ainda habilitar por fila para que tenham efeito.
  auto_transcribe_audio?: boolean;
  auto_summary_on_resolve?: boolean;
  auto_summary_on_close?: boolean;
}

export const DEFAULT_CHAT_SETTINGS: ChatClientSettingsJson = {
  QUEUE_LIMIT: 1,
  ALLOW_GROUPS: false,
  SHOW_GROUPS_TAB: false,
  AUTO_ASSIGN_ON_REPLY: true,
  BUSINESS_HOURS_BLOCK: false,
  QUICK_REPLIES_ENABLED: true,
  READ_RECEIPTS: true,
  TYPING_INDICATOR: true,
  AUTO_RESUME_AFTER_HOURS: 24,
  MAX_FILE_SIZE_MB: 16,
  NOTIFICATION_SOUND: true,
  SHOW_INTERNAL_NOTES: true,
  history_sync_days: 7,
  auto_transcribe_audio: false,
  auto_summary_on_resolve: false,
  auto_summary_on_close: false,
};

export interface ChatClientSettingRow {
  id: string;
  client_id: string;
  client_name: string | null;
  client_business_name: string | null;
  settings: ChatClientSettingsJson;
  created_at: string;
  updated_at: string;
}

export function useChatClientSettings() {
  return useQuery({
    queryKey: ['chat-client-settings'],
    queryFn: async (): Promise<ChatClientSettingRow[]> => {
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        settings: { ...DEFAULT_CHAT_SETTINGS, ...(r.settings ?? {}) },
      }));
    },
  });
}

export function useChatClientSettingsMutations() {
  const qc = useQueryClient();

  const upsertSettings = useMutation({
    mutationFn: async (input: {
      client_id: string;
      client_name?: string | null;
      client_business_name?: string | null;
      settings: ChatClientSettingsJson;
    }) => {
      const { data, error } = await supabase
        .from('chat_client_settings')
        .upsert(
          {
            client_id: input.client_id,
            client_name: input.client_name ?? null,
            client_business_name: input.client_business_name ?? null,
            settings: input.settings as any,
          },
          { onConflict: 'client_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-client-settings'] });
      qc.invalidateQueries({ queryKey: ['agent-queue-limits'] });
      toast.success('Configuração salva');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar configuração'),
  });

  const deleteSettings = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_client_settings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-client-settings'] });
      qc.invalidateQueries({ queryKey: ['agent-queue-limits'] });
      toast.success('Configuração removida');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });

  return { upsertSettings, deleteSettings };
}
