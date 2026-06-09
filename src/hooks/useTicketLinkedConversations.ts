import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TicketStatus, TicketPriority } from '@/pages/tickets/types';

export interface TicketConversationLink {
  ticketId: string;
  number: number | null;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
}

/**
 * Returns Map<conversation_id, TicketConversationLink> for chat conversations
 * that have an OPEN support ticket linked via chat_conversations.active_ticket_id.
 *
 * The link column is maintained by a DB trigger on support_tickets, so this
 * hook only does two cheap lookups (no N+1, no per-conversation join).
 */
export function useTicketLinkedConversations() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const query = useQuery({
    queryKey: ['ticket-linked-conversations', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const map = new Map<string, TicketConversationLink>();

      const { data: convs, error: convErr } = await supabase
        .from('chat_conversations')
        .select('id, active_ticket_id, active_ticket_number')
        .eq('client_id', clientId)
        .not('active_ticket_id', 'is', null);
      if (convErr || !convs?.length) return map;

      const ticketIds = Array.from(
        new Set(
          convs
            .map((r: any) => r.active_ticket_id as string | null)
            .filter((v): v is string => !!v),
        ),
      );
      if (!ticketIds.length) return map;

      const { data: tickets, error: tErr } = await supabase
        .from('support_tickets')
        .select('id, number, status, priority, subject')
        .in('id', ticketIds);
      if (tErr) return map;

      const tById = new Map<string, any>();
      for (const t of tickets || []) tById.set(t.id, t);

      for (const r of convs as any[]) {
        const t = tById.get(r.active_ticket_id);
        if (!t) continue;
        map.set(r.id, {
          ticketId: t.id,
          number: (t.number as number) ?? (r.active_ticket_number as number) ?? null,
          status: t.status,
          priority: t.priority,
          subject: t.subject ?? '',
        });
      }
      return map;
    },
  });

  // Realtime: invalidate when any ticket changes (low frequency).
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase
      .channel(`ticket_linked_conv_${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => { query.refetch(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return query;
}