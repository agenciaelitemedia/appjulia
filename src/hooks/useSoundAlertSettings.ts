import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export interface SoundAlertSettings {
  enabled: boolean;
  userCanDisable: boolean;
  mutedUsers: Record<string, boolean>;
}

export const SOUND_ALERT_DEFAULTS: SoundAlertSettings = {
  enabled: true,
  userCanDisable: true,
  mutedUsers: {},
};

function parseSoundSettings(raw: unknown): SoundAlertSettings {
  if (!raw || typeof raw !== 'object') return SOUND_ALERT_DEFAULTS;
  const s = raw as Record<string, unknown>;
  return {
    enabled: Boolean(s.sound_alert_enabled ?? true),
    userCanDisable: Boolean(s.sound_alert_user_can_disable ?? true),
    mutedUsers:
      s.sound_alert_muted_users && typeof s.sound_alert_muted_users === 'object'
        ? (s.sound_alert_muted_users as Record<string, boolean>)
        : {},
  };
}

/**
 * Hook compartilhado do alerta sonoro de novas mensagens.
 *
 * - Resolve o client_id efetivo (próprio ou herdado do dono do escritório)
 * - Lê sound_alert_enabled / sound_alert_user_can_disable / sound_alert_muted_users
 *   do JSON de chat_client_settings (defaults: ativo / permitido / ninguém silenciado)
 * - Assina Realtime de chat_client_settings → mudanças refletem imediatamente
 *   em todas as sessões (header, /equipe e o próprio som)
 * - Expõe mutation para silenciar/reativar o som de um usuário
 */
export function useSoundAlertSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState<string | null>(null);

  // Resolve o client_id efetivo (próprio ou herdado do dono do escritório)
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!user?.id) {
        if (!cancelled) setClientId(null);
        return;
      }
      if (user.client_id) {
        if (!cancelled) setClientId(String(user.client_id));
        return;
      }
      try {
        const inherited = await externalDb.getEffectiveClientId(Number(user.id));
        if (!cancelled) setClientId(inherited ? String(inherited) : null);
      } catch {
        if (!cancelled) setClientId(null);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.client_id]);

  const { data: settings = SOUND_ALERT_DEFAULTS, isLoading } = useQuery({
    queryKey: ['sound-alert-settings', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<SoundAlertSettings> => {
      const { data, error } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return parseSoundSettings(data?.settings);
    },
  });

  // Realtime: qualquer alteração nas configurações do cliente reflete na hora
  useEffect(() => {
    if (!clientId) return;

    const channelName = `ccs_sound_${clientId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_client_settings',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sound-alert-settings', clientId] });
          queryClient.invalidateQueries({ queryKey: ['chat-client-settings', clientId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  // Silenciar/reativar o som de um usuário (merge preservando as demais chaves)
  const toggleUserMute = useMutation({
    mutationFn: async ({ userId, mute }: { userId: string; mute: boolean }) => {
      if (!clientId) throw new Error('Cliente não identificado');

      const { data: current } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', clientId)
        .maybeSingle();

      const existing = (current?.settings as Record<string, unknown>) ?? {};
      const muted = {
        ...((existing.sound_alert_muted_users as Record<string, boolean>) ?? {}),
      };
      if (mute) muted[userId] = true;
      else delete muted[userId];

      const merged = { ...existing, sound_alert_muted_users: muted };

      const { error } = await supabase
        .from('chat_client_settings')
        .upsert({ client_id: clientId, settings: merged }, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sound-alert-settings', clientId] });
    },
  });

  const isUserMuted = useCallback(
    (userId: string | number) => Boolean(settings.mutedUsers[String(userId)]),
    [settings.mutedUsers],
  );

  const isSoundActiveFor = useCallback(
    (userId: string | number) => settings.enabled && !isUserMuted(userId),
    [settings.enabled, isUserMuted],
  );

  return { clientId, settings, isLoading, isUserMuted, isSoundActiveFor, toggleUserMute };
}