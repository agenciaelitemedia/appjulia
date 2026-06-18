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
            .select('assigned_to, assigned_user_id')
            .eq('client_id', clientId)
            .in('status', ['open', 'pending'])
            .or(`assigned_user_id.in.(${idsAsText.join(',') || '0'}),assigned_to.in.(${names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(',')})`)
        : Promise.resolve({ data: [] as any[] });

      const dealsP = names.length > 0
        ? supabase
            .from('crm_deals')
            .select('assigned_to,assigned_user_id,status')
            .or(`assigned_user_id.in.(${idsAsText.join(',') || '0'}),assigned_to.in.(${names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(',')})`)
        : Promise.resolve({ data: [] as any[] });

      const tasksP = supabase
        .from('tasks')
        .select('assigned_to, assigned_user_id')
        .eq('client_id', clientId)
        .in('status', ['pending', 'in_progress'])
        .or(`assigned_user_id.in.(${idsAsText.join(',') || '0'}),assigned_to.in.(${idsAsText.map((s) => `"${s}"`).join(',')})`);

      const [chats, deals, tasks] = await Promise.all([chatsP, dealsP, tasksP]);

      const resolveIds = (row: { assigned_user_id?: number | string | null; assigned_to?: string | null }): string[] => {
        if (row.assigned_user_id != null) {
          const id = String(row.assigned_user_id);
          return map[id] ? [id] : [];
        }
        const key = (row.assigned_to || '').trim();
        return key ? (nameToIds[key] || []) : [];
      };

      for (const row of ((chats as any).data ?? []) as Array<any>) {
        for (const id of resolveIds(row)) map[id].open_chats++;
      }
      for (const row of ((deals as any).data ?? []) as Array<any>) {
        const s = (row.status || '').toLowerCase();
        if (s === 'won' || s === 'lost') continue;
        for (const id of resolveIds(row)) map[id].open_crm_deals++;
      }
      for (const row of ((tasks as any).data ?? []) as Array<any>) {
        for (const id of resolveIds(row)) map[id].open_tasks++;
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