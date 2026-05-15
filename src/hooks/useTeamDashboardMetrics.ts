import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamUserMetrics {
  open_chats: number;
  open_crm_deals: number;
  open_tasks: number;
}

export interface TeamMemberRef {
  id: number;
  name: string;
}

/**
 * Conta por usuário (id):
 *  - chats abertos (status open|pending) — `assigned_to` armazena NOME
 *  - cards CRM abertos (≠ won/lost)      — `assigned_to` armazena NOME
 *  - tarefas abertas (pending|in_progress) — `assigned_to` armazena ID
 */
export function useTeamDashboardMetrics(members: TeamMemberRef[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const { idsAsText, names, nameToIds } = useMemo(() => {
    const ids = [...new Set(members.map((m) => String(m.id)))].sort();
    const nm = [...new Set(members.map((m) => (m.name || '').trim()).filter(Boolean))];
    const map: Record<string, string[]> = {};
    for (const m of members) {
      const key = (m.name || '').trim();
      if (!key) continue;
      (map[key] ||= []).push(String(m.id));
    }
    return { idsAsText: ids, names: nm, nameToIds: map };
  }, [members]);

  const queryKey = ['team-dashboard-metrics', clientId, idsAsText.join(','), names.join('|')];

  const query = useQuery<Record<string, TeamUserMetrics>>({
    queryKey,
    enabled: !!clientId && idsAsText.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const map: Record<string, TeamUserMetrics> = {};
      for (const id of idsAsText) {
        map[id] = { open_chats: 0, open_crm_deals: 0, open_tasks: 0 };
      }

      const chatsP = names.length > 0
        ? supabase
            .from('chat_conversations')
            .select('assigned_to')
            .eq('client_id', clientId)
            .in('status', ['open', 'pending'])
            .in('assigned_to', names)
        : Promise.resolve({ data: [] as any[] });

      const dealsP = names.length > 0
        ? supabase
            .from('crm_deals')
            .select('assigned_to,status')
            .in('assigned_to', names)
        : Promise.resolve({ data: [] as any[] });

      const tasksP = supabase
        .from('tasks')
        .select('assigned_to')
        .eq('client_id', clientId)
        .in('status', ['pending', 'in_progress'])
        .in('assigned_to', idsAsText);

      const [chats, deals, tasks] = await Promise.all([chatsP, dealsP, tasksP]);

      for (const row of ((chats as any).data ?? []) as Array<{ assigned_to: string | null }>) {
        const ids = row.assigned_to ? nameToIds[row.assigned_to.trim()] : null;
        if (!ids) continue;
        for (const id of ids) map[id].open_chats++;
      }
      for (const row of ((deals as any).data ?? []) as Array<{ assigned_to: string | null; status: string | null }>) {
        const s = (row.status || '').toLowerCase();
        if (s === 'won' || s === 'lost') continue;
        const ids = row.assigned_to ? nameToIds[row.assigned_to.trim()] : null;
        if (!ids) continue;
        for (const id of ids) map[id].open_crm_deals++;
      }
      for (const row of ((tasks as any).data ?? []) as Array<{ assigned_to: string | null }>) {
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