import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { supabase } from '@/integrations/supabase/client';
import type { CRMDeal } from '../types';

export interface ChatLink {
  conversation_id: string | null;
  contact_id?: string | null;
  contact_phone?: string | null;
  contact_name?: string | null;
}

export interface JuliaLink {
  card_id: number;
  whatsapp_number: string;
  cod_agent: string;
  stage_id?: number;
  stage_name?: string | null;
}

function readLinks(deal: CRMDeal | null | undefined) {
  const cf = (deal?.custom_fields ?? {}) as Record<string, unknown>;
  const links = (cf.links ?? {}) as Record<string, unknown>;
  return {
    chat: (links.chat as ChatLink | undefined) ?? null,
    julia: (links.julia as JuliaLink | undefined) ?? null,
  };
}

export function getChatLink(deal: CRMDeal | null | undefined): ChatLink | null {
  return readLinks(deal).chat;
}

export function getJuliaLink(deal: CRMDeal | null | undefined): JuliaLink | null {
  return readLinks(deal).julia;
}

export function useChatConversationPreview(
  conversationId: string | null | undefined,
  contactIdFallback?: string | null,
) {
  return useQuery({
    queryKey: ['chat-conversation-preview', conversationId, contactIdFallback ?? null],
    queryFn: async () => {
      const fetchById = async (id: string) => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, status, assigned_to, protocol, channel, updated_at, contact_id, queue_id, queues:queue_id(is_deleted)')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (data && (data as any).queues?.is_deleted === true) return null;
        return data;
      };

      if (conversationId) {
        const found = await fetchById(conversationId);
        if (found) return found;
      }
      // Fallback: pinned conversation gone / queue deleted → resolve latest by contact_id
      if (contactIdFallback) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, status, assigned_to, protocol, channel, updated_at, contact_id, queue_id, queues:queue_id(is_deleted)')
          .eq('contact_id', contactIdFallback)
          .order('updated_at', { ascending: false })
          .limit(5);
        if (error) throw error;
        const alive = (data ?? []).find((r: any) => r.queues?.is_deleted !== true);
        return alive ?? null;
      }
      return null;
    },
    enabled: !!conversationId || !!contactIdFallback,
    staleTime: 30_000,
  });
}

export function useJuliaCardPreview(link: JuliaLink | null) {
  return useQuery({
    queryKey: ['julia-card-preview', link?.card_id],
    queryFn: async () => {
      if (!link) return null;
      const rows = await externalDb.raw<{
        id: number;
        contact_name: string | null;
        whatsapp_number: string;
        business_name: string | null;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
        updated_at: string | null;
        cod_agent: string;
      }>({
        query: `
          SELECT c.id, c.contact_name, c.whatsapp_number, c.business_name,
                 c.stage_id, c.cod_agent, c.updated_at,
                 s.name as stage_name, s.color as stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.id = $1
          LIMIT 1
        `,
        params: [link.card_id],
      });
      return rows[0] ?? null;
    },
    enabled: !!link?.card_id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}