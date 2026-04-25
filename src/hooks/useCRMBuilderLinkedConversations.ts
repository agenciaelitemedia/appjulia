import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns a Set of conversation_ids that have at least one non-archived deal
 * in the CRM Builder linked via custom_fields.links.chat.conversation_id.
 *
 * This is a STRONG link (UUID, immutable) — preferred over phone matching,
 * which breaks when the contact phone is edited.
 */
export function useCRMBuilderLinkedConversations() {
  const { user } = useAuth();
  const clientId = String(user?.cod_agent || user?.id || '');

  return useQuery({
    queryKey: ['crm-builder-linked-conversations', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('custom_fields')
        .eq('client_id', clientId)
        .neq('status', 'archived');
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data || []) {
        const cf = (row as { custom_fields?: Record<string, unknown> }).custom_fields || {};
        const links = (cf as any).links as Record<string, any> | undefined;
        const convId = links?.chat?.conversation_id;
        if (typeof convId === 'string' && convId) set.add(convId);
      }
      return set;
    },
  });
}
