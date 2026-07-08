import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChatLinkedDeal {
  id: string;
  title: string;
  description: string | null;
  value: number;
  currency: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'won' | 'lost' | 'archived';
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  assigned_to: string | null;
  tags: string[] | null;
  expected_close_date: string | null;
  pipeline_id: string;
  board_id: string;
  client_id: string;
  cod_agent: string | null;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, unknown> | null;
  board: { id: string; name: string; color: string | null } | null;
  pipeline: { id: string; name: string; color: string | null } | null;
}

/**
 * Returns the open `crm_deals` row linked to the current chat conversation.
 *
 * Lookup order (returns first hit, always with `client_id = clientId` and
 * `status != 'archived'`, ordered by `created_at desc`):
 *   1) custom_fields.links.chat.contact_id === contactId   (stable anchor)
 *   2) custom_fields.links.chat.conversation_id === conversationId (compat)
 *   3) custom_fields.links.chat.contact_phone === contactPhone (legacy fallback)
 *
 * When a deal is found via stages (2) or (3), the row is "self-healed":
 * we merge the current `contact_id` and `conversation_id` into
 * `custom_fields.links.chat`, so subsequent lookups hit stage (1) and no
 * duplicate cards are created after a queue disconnect/reconnect creates
 * a new conversation row for the same contact.
 */
export function useChatDealLink(
  conversationId: string | null | undefined,
  clientId: string | null | undefined,
  contactId?: string | null,
  contactPhone?: string | null,
) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['chat-deal-link', conversationId, clientId, contactId ?? null, contactPhone ?? null],
    enabled: !!clientId && (!!conversationId || !!contactId || !!contactPhone),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ChatLinkedDeal | null> => {
      if (!clientId) return null;

      const selectCols = `
          id, title, description, value, currency, priority, status,
          contact_name, contact_phone, contact_email,
          assigned_to, tags, expected_close_date,
          pipeline_id, board_id, client_id, cod_agent,
          stage_entered_at, created_at, updated_at,
          custom_fields,
          board:crm_boards(id,name,color),
          pipeline:crm_pipelines(id,name,color)
        `;

      const lookup = async (filter: Record<string, unknown>): Promise<ChatLinkedDeal | null> => {
        const { data, error } = await supabase
          .from('crm_deals')
          .select(selectCols)
          .eq('client_id', clientId)
          .neq('status', 'archived')
          .contains('custom_fields', { links: { chat: filter } } as any)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('[useChatDealLink] lookup error', error);
          return null;
        }
        return (data as unknown as ChatLinkedDeal) ?? null;
      };

      // Stage 1 — stable anchor by contact_id
      let deal: ChatLinkedDeal | null = null;
      let matchedStage: 1 | 2 | 3 | null = null;
      if (contactId) {
        deal = await lookup({ contact_id: contactId });
        if (deal) matchedStage = 1;
      }
      // Stage 2 — current conversation_id (legacy primary key)
      if (!deal && conversationId) {
        deal = await lookup({ conversation_id: conversationId });
        if (deal) matchedStage = 2;
      }
      // Stage 3 — legacy fallback by phone
      if (!deal && contactPhone) {
        deal = await lookup({ contact_phone: contactPhone });
        if (deal) matchedStage = 3;
      }

      if (!deal) return null;

      // Self-heal: if matched via legacy stage, backfill contact_id and refresh
      // conversation_id so future lookups hit stage 1.
      if (matchedStage !== 1 && (contactId || conversationId)) {
        try {
          const cf = (deal.custom_fields ?? {}) as Record<string, any>;
          const existingLinks = (cf.links ?? {}) as Record<string, any>;
          const existingChat = (existingLinks.chat ?? {}) as Record<string, any>;
          const nextChat = {
            ...existingChat,
            ...(contactId ? { contact_id: contactId } : {}),
            ...(conversationId ? { conversation_id: conversationId } : {}),
            ...(contactPhone && !existingChat.contact_phone ? { contact_phone: contactPhone } : {}),
          };
          const nextCustomFields = {
            ...cf,
            links: { ...existingLinks, chat: nextChat },
          };
          const { error: healErr } = await supabase
            .from('crm_deals')
            .update({ custom_fields: nextCustomFields } as any)
            .eq('id', deal.id);
          if (healErr) {
            console.warn('[useChatDealLink] self-heal failed', healErr);
          } else {
            // Reflect healed values in returned deal to avoid stale reads
            deal = { ...deal, custom_fields: nextCustomFields } as ChatLinkedDeal;
            // Invalidate related caches so builder-side previews refresh
            qc.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
          }
        } catch (e) {
          console.warn('[useChatDealLink] self-heal exception', e);
        }
      }

      return deal;
    },
  });
}