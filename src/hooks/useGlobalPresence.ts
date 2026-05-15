import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Track global presence on a per-client channel.
 * Should be mounted once (in MainLayout) so cada usuário
 * fica anunciado enquanto a aba estiver aberta.
 */
export function useGlobalPresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !user?.client_id) return;

    const channelName = `presence:client:${user.client_id}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: String(user.id) } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: Number(user.id),
          user_name: user.name,
          user_avatar: user.avatar || null,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      try {
        channel.untrack();
      } catch { /* ignore */ }
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.client_id, user?.name, user?.avatar]);
}