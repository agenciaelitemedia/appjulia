import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CrmBuilderLink {
  boardName: string | null;
  boardColor: string | null;
  pipelineName: string | null;
  pipelineColor: string | null;
}

export interface CrmBuilderLinkMaps {
  byConversation: Map<string, CrmBuilderLink>;
  byContact: Map<string, CrmBuilderLink>;
}

/**
 * Returns two maps of CRM Builder links for non-archived deals:
 *  - byConversation: keyed by the deal's stored chat.conversation_id
 *  - byContact:      keyed by contact_id (resolved from the deal's stored
 *                    chat.contact_id, or via lookup on chat_conversations
 *                    when only conversation_id is stored)
 *
 * The contact-level map is used as a fallback in the chat list so the badge
 * survives when the "leader" conversation for a contact changes (new
 * conversation in a different queue/channel) — the deal is still linked to
 * that contact even if the specific conversation_id no longer matches.
 */
export function useCRMBuilderLinkedConversations() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery({
    queryKey: ['crm-builder-linked-conversations', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async (): Promise<CrmBuilderLinkMaps> => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('custom_fields, updated_at, crm_boards(name,color), crm_pipelines(name,color)')
        .eq('client_id', clientId)
        .neq('status', 'archived');
      if (error) throw error;
      type Row = {
        custom_fields?: Record<string, unknown>;
        updated_at?: string | null;
        crm_boards?: { name?: string; color?: string } | null;
        crm_pipelines?: { name?: string; color?: string } | null;
      };

      const byConversation = new Map<string, CrmBuilderLink>();
      const byContact = new Map<string, CrmBuilderLink>();
      const contactPickedAt = new Map<string, number>();

      // Track deals whose contact_id we still need to resolve via chat_conversations
      const needsResolution: Array<{ convId: string; link: CrmBuilderLink; ts: number }> = [];

      for (const row of (data || []) as Row[]) {
        const cf = row.custom_fields || {};
        const links = (cf as any).links as Record<string, any> | undefined;
        const chatLink = links?.chat;
        const convId = typeof chatLink?.conversation_id === 'string' ? chatLink.conversation_id : null;
        const contactId = typeof chatLink?.contact_id === 'string' ? chatLink.contact_id : null;
        if (!convId && !contactId) continue;

        const link: CrmBuilderLink = {
          boardName: row.crm_boards?.name ?? null,
          boardColor: row.crm_boards?.color ?? null,
          pipelineName: row.crm_pipelines?.name ?? null,
          pipelineColor: row.crm_pipelines?.color ?? null,
        };
        const ts = row.updated_at ? Date.parse(row.updated_at) || 0 : 0;

        if (convId) byConversation.set(convId, link);

        if (contactId) {
          const prev = contactPickedAt.get(contactId) ?? -1;
          if (ts >= prev) {
            byContact.set(contactId, link);
            contactPickedAt.set(contactId, ts);
          }
        } else if (convId) {
          needsResolution.push({ convId, link, ts });
        }
      }

      // Resolve missing contact_ids from chat_conversations (batched)
      if (needsResolution.length > 0) {
        const convIds = Array.from(new Set(needsResolution.map((r) => r.convId)));
        const convToContact = new Map<string, string>();
        const chunkSize = 500;
        for (let i = 0; i < convIds.length; i += chunkSize) {
          const chunk = convIds.slice(i, i + chunkSize);
          const { data: convs, error: cErr } = await supabase
            .from('chat_conversations')
            .select('id, contact_id')
            .in('id', chunk);
          if (cErr) throw cErr;
          for (const c of (convs || []) as Array<{ id: string; contact_id: string | null }>) {
            if (c.contact_id) convToContact.set(c.id, c.contact_id);
          }
        }
        for (const entry of needsResolution) {
          const contactId = convToContact.get(entry.convId);
          if (!contactId) continue;
          const prev = contactPickedAt.get(contactId) ?? -1;
          if (entry.ts >= prev) {
            byContact.set(contactId, entry.link);
            contactPickedAt.set(contactId, entry.ts);
          }
        }
      }

      return { byConversation, byContact };
    },
  });
}
