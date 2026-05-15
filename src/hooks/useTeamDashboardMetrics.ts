import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamUserMetrics {
  open_chats: number;
  open_crm_deals: number;
  open_tasks: number;
}

/**
 * Conta para cada user_id (string ou número):
 *  - chats abertos (status open|pending)
 *  - cards CRM abertos (status open ou estágio não won/lost)
 *  - tarefas abertas (pending|in_progress)
 * Atualiza via Realtime em chat_conversations, crm_deals e tasks.
 */
export function useTeamDashboardMetrics(userIds: number[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const idsAsText = [...new Set(userIds.map(String))].sort();
  const key = ['team-dashboard-metrics', clientId, idsAsText.join(',')];

  const query = useQuery<Record<string, TeamUserMetrics>>({
    queryKey: key,
    enabled: !!clientId && idsAsText.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const map: Record<string, TeamUserMetrics> = {};
      for (const id of idsAsText) {
        map[id] = { open_chats: 0, open_crm_deals: 0, open_tasks: 0 };
      }

      const [chats, deals, tasks] = await Promise.all([
        supabase
          .from('chat_conversations')
          .select('assigned_to')
          .eq('client_id', clientId)
          .in('status', ['open', 'pending'])
          .in('assigned_to', idsAsText),
        supabase
          .from('crm_deals')
          .select('assigned_to,status')
          .in('assigned_to', idsAsText),
        supabase
          .from('tasks')
          .select('assigned_to')
          .eq('client_id', clientId)
          .in('status', ['pending', 'in_progress'])
          .in('assigned_to', idsAsText),
      ]);

      for (const row of (chats.data ?? []) as Array<{ assigned_to: string | null }>) {
        if (row.assigned_to && map[row.assigned_to]) map[row.assigned_to].open_chats++;
      }
      for (const row of (deals.data ?? []) as Array<{ assigned_to: string | null; status: string | null }>) {
        const s = (row.status || '').toLowerCase();
        if (s === 'won' || s === 'lost') continue;
        if (row.assigned_to && map[row.assigned_to]) map[row.assigned_to].open_crm_deals++;
      }
      for (const row of (tasks.data ?? []) as Array<{ assigned_to: string | null }>) {
        if (row.assigned_to && map[row.assigned_to]) map[row.assigned_to].open_tasks++;
      }

      return map;
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['team-dashboard-metrics', clientId] });
    const channels = ['chat_conversations', 'crm_deals', 'tasks'].map((table) =>
      supabase
        .channel(`team-metrics:${table}:${clientId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, invalidate)
        .subscribe(),
    );
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [clientId, qc]);

  return query;
}