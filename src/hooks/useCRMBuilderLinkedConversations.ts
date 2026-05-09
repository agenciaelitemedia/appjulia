import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CrmBuilderLink {
  boardName: string | null;
  boardColor: string | null;
  pipelineName: string | null;
  pipelineColor: string | null;
}

/**
 * Returns a Map<conversation_id, CrmBuilderLink> for non-archived deals
 * in the CRM Builder linked via custom_fields.links.chat.conversation_id.
 *
 * This is a STRONG link (UUID, immutable) — preferred over phone matching,
 * which breaks when the contact phone is edited.
 */
export function useCRMBuilderLinkedConversations() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery({
    queryKey: ['crm-builder-linked-conversations', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('custom_fields, crm_boards(name,color), crm_pipelines(name,color)')
        .eq('client_id', clientId)
        .neq('status', 'archived');
      if (error) throw error;
      const map = new Map<string, CrmBuilderLink>();
      for (const row of data || []) {
        const r = row as {
          custom_fields?: Record<string, unknown>;
          crm_boards?: { name?: string; color?: string } | null;
          crm_pipelines?: { name?: string; color?: string } | null;
        };
        const cf = r.custom_fields || {};
        const links = (cf as any).links as Record<string, any> | undefined;
        const convId = links?.chat?.conversation_id;
        if (typeof convId === 'string' && convId) {
          map.set(convId, {
            boardName: r.crm_boards?.name ?? null,
            boardColor: r.crm_boards?.color ?? null,
            pipelineName: r.crm_pipelines?.name ?? null,
            pipelineColor: r.crm_pipelines?.color ?? null,
          });
        }
      }
      return map;
    },
  });
}
