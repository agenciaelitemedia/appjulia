import { useQuery } from '@tanstack/react-query';
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
 * Returns the open `crm_deals` row whose custom_fields.links.chat.conversation_id
 * matches the active conversation. Used by the chat header CRM button.
 */
export function useChatDealLink(conversationId: string | null | undefined, clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['chat-deal-link', conversationId, clientId],
    enabled: !!conversationId && !!clientId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ChatLinkedDeal | null> => {
      if (!conversationId || !clientId) return null;

      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id, title, description, value, currency, priority, status,
          contact_name, contact_phone, contact_email,
          assigned_to, tags, expected_close_date,
          pipeline_id, board_id, client_id, cod_agent,
          stage_entered_at, created_at, updated_at,
          custom_fields,
          board:crm_boards(id,name,color),
          pipeline:crm_pipelines(id,name,color)
        `)
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .contains('custom_fields', { links: { chat: { conversation_id: conversationId } } } as any)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[useChatDealLink] error', error);
        return null;
      }
      return (data as unknown as ChatLinkedDeal) ?? null;
    },
  });
}