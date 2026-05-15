import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserLastActivity {
  user_id: number;
  last_login_at: string | null;
  last_logout_at: string | null;
  last_logout_type: 'logout_manual' | 'logout_inactivity' | null;
}

/**
 * Última atividade (login/logout) por usuário, com Realtime.
 */
export function useTeamLastActivity(userIds: number[]) {
  const qc = useQueryClient();
  const ids = [...new Set(userIds.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  const key = ['team-last-activity', ids.join(',')];

  const query = useQuery<Record<number, UserLastActivity>>({
    queryKey: key,
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_last_activity')
        .select('*')
        .in('user_id', ids);
      if (error) throw error;
      const map: Record<number, UserLastActivity> = {};
      for (const row of ((data ?? []) as unknown as UserLastActivity[])) {
        map[Number(row.user_id)] = row;
      }
      return map;
    },
  });

  useEffect(() => {
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`user_activity_log:${ids.join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_activity_log' },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return query;
}