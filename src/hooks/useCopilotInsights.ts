import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export interface CopilotInsight {
  id: string;
  user_id: number;
  cod_agent: string;
  insight_type: string;
  severity: string;
  title: string;
  description: string;
  related_cards: any[];
  is_read: boolean;
  created_at: string;
}

export function useCopilotInsights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['copilot-insights', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('crm_copilot_insights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as CopilotInsight[];
    },
    enabled: !!user?.id,
  });

  // Check if user has any agent with COPILOT_INTERACTIVE enabled
  const interactiveQuery = useQuery({
    queryKey: ['copilot-interactive-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      try {
        const agents = await externalDb.getUserAgents(user.id);
        return agents.some((ua: any) => {
          try {
            const settings = typeof ua.settings === 'string' ? JSON.parse(ua.settings) : ua.settings;
            return settings?.COPILOT_INTERACTIVE === true;
          } catch { return false; }
        });
      } catch { return false; }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('copilot-insights-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_copilot_insights',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['copilot-insights', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from('crm_copilot_insights')
        .update({ is_read: true } as any)
        .eq('id', insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-insights', user?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('crm_copilot_insights')
        .update({ is_read: true } as any)
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-insights', user?.id] });
    },
  });

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((i) => !i.is_read).length,
    [query.data]
  );

  return {
    insights: query.data ?? [],
    isLoading: query.isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    hasInteractive: interactiveQuery.data ?? false,
  };
}
