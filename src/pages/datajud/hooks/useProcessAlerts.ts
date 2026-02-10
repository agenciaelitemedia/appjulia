import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import type { ProcessAlert } from '../types';

export function useProcessAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['datajud', 'alerts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datajud_alerts')
        .select('*, process:datajud_monitored_processes(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as ProcessAlert[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = (query.data || []).filter(a => !a.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('datajud_alerts')
        .update({ is_read: true } as any)
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'alerts'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('datajud_alerts')
        .update({ is_read: true } as any)
        .eq('user_id', user!.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'alerts'] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('datajud-alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'datajud_alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['datajud', 'alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    alerts: query.data || [],
    unreadCount,
    isLoading: query.isLoading,
    markAsRead,
    markAllAsRead,
  };
}
