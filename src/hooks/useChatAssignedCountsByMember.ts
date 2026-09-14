import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Retorna um mapa `nome → quantidade de conversas abertas/pendentes` atribuídas
 * a esse nome. `chat_conversations.assigned_to` armazena o NOME do membro.
 *
 * A contagem é feita no banco (RPC `chat_assigned_counts_by_member`): antes o
 * hook baixava TODAS as conversas abertas/pendentes do escritório a cada 60 s e
 * a cada evento de tempo real, o que virou uma das consultas mais executadas do
 * sistema. Os eventos de tempo real agora agrupam invalidações (debounce).
 */
export function useChatAssignedCountsByMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery<Record<string, number>>({
    queryKey: ['chat-assigned-counts-by-member', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('chat_assigned_counts_by_member' as never, {
        p_client_id: clientId,
      } as never);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ assigned_to: string | null; total: number | string }>) {
        const key = (row.assigned_to || '').trim();
        if (!key) continue;
        map[key] = Number(row.total) || 0;
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
        { event: '*', schema: 'public', table: 'chat_conversations', filter: `client_id=eq.${clientId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['chat-assigned-counts-by-member', clientId] });
          }, 5_000);
        },
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [clientId, qc]);

  return query;
}
