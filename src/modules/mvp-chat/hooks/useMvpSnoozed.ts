/**
 * useMvpSnoozed — busca as conversas adiadas ativas direto no banco,
 * exatamente como o /chat faz (não depende da lista paginada do feed,
 * que esconde adiados por padrão).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { MvpChatRowData } from '../api/types';

export function useMvpSnoozed(clientId: string | null, scopeQueueIds: string[]) {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['mvp-chat-snoozed', clientId, scopeQueueIds.slice().sort().join(',')],
    enabled: !!clientId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<MvpChatRowData[]> => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from('chat_conversations')
        .select('id, contact_id, queue_id, status, priority, assigned_to, channel, protocol, snoozed_until, snooze_reason, updated_at')
        .eq('client_id', String(clientId))
        .not('snoozed_until', 'is', null)
        .gt('snoozed_until', nowIso)
        .order('snoozed_until', { ascending: true })
        .limit(200);

      if (scopeQueueIds.length > 0) q = q.in('queue_id', scopeQueueIds);

      const { data: convs, error } = await q;
      if (error) throw error;
      const rows = (convs ?? []) as Array<Record<string, any>>;
      if (rows.length === 0) return [];

      const contactIds = Array.from(new Set(rows.map((r) => r.contact_id).filter(Boolean)));
      const { data: contacts } = await supabase
        .from('chat_contacts')
        .select('id, name, phone, avatar_url, last_message_preview')
        .in('id', contactIds);
      const contactMap = new Map(
        ((contacts ?? []) as Array<Record<string, any>>).map((c) => [c.id, c]),
      );

      const queueIds = Array.from(new Set(rows.map((r) => r.queue_id).filter(Boolean)));
      let queueMap = new Map<string, string>();
      if (queueIds.length > 0) {
        const { data: queuesData } = await supabase
          .from('queues')
          .select('id, name')
          .in('id', queueIds);
        queueMap = new Map(
          ((queuesData ?? []) as Array<Record<string, any>>).map((q2) => [q2.id, q2.name]),
        );
      }

      // uma conversa por contato (a de retorno mais próximo)
      const seen = new Set<string>();
      const out: MvpChatRowData[] = [];
      for (const r of rows) {
        if (!r.contact_id || seen.has(r.contact_id)) continue;
        seen.add(r.contact_id);
        const c = contactMap.get(r.contact_id) ?? {};
        out.push({
          contact_id: r.contact_id,
          contact_name: c.name ?? null,
          phone: c.phone ?? null,
          avatar: c.avatar_url ?? null,
          avatar_storage_path: null,
          is_group: false,
          unread_count: 0,
          last_message_at: null,
          last_message_text: c.last_message_preview ?? null,
          channel_source: null,
          channel_type: null,
          lead_full_name: null,
          conversation_id: r.id,
          queue_id: r.queue_id ?? null,
          queue_name: r.queue_id ? queueMap.get(r.queue_id) ?? null : null,
          queue_is_active: null,
          channel: r.channel ?? null,
          status: r.status,
          protocol: r.protocol ?? null,
          assigned_to: r.assigned_to ?? null,
          assigned_user_id: null,
          priority: r.priority ?? 'normal',
          opened_at: r.updated_at,
          first_response_at: null,
          resolved_at: null,
          closed_at: null,
          snoozed_until: r.snoozed_until,
          snooze_reason: r.snooze_reason ?? null,
          last_customer_message_at: null,
          last_message_from_me: null,
          conversation_updated_at: r.updated_at,
          sla_status: null,
          sla_type: null,
          sla_remaining_minutes: null,
          sla_target_minutes: null,
          tags: [],
          active_ticket_id: null,
          active_ticket_number: null,
          active_ticket_protocol: null,
          ticket_status: null,
          ticket_priority: null,
          ticket_subject: null,
          crm_board_name: null,
          crm_board_color: null,
          crm_pipeline_name: null,
          crm_pipeline_color: null,
          queue_cod_agent: null,
          phone_key: null,
          julia_stage_id: null,
        } as MvpChatRowData);
      }
      return out;
    },
  });

  return { snoozedItems: data ?? [], snoozedLoading: isLoading, refetchSnoozed: refetch };
}
