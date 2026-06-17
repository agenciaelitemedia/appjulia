import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Retorna um mapa `nome → quantidade de conversas abertas/pendentes` atribuídas
 * a esse nome. `chat_conversations.assigned_to` armazena o NOME do membro.
 */
export function useChatAssignedCountsByMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const query = useQuery<Record<string, number>>({
    queryKey: ['chat-assigned-counts-by-member', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('assigned_to')
        .eq('client_id', clientId)
        .in('status', ['open', 'pending']);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ assigned_to: string | null }>) {
        const key = (row.assigned_to || '').trim();
        if (!key) continue;
        map[key] = (map[key] || 0) + 1;
      }
      return map;
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`chat-assigned-counts:${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => qc.invalidateQueries({ queryKey: ['chat-assigned-counts-by-member', clientId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, qc]);

  return query;
}