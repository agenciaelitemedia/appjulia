import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';
import { normalizeBrPhone, brPhoneVariants } from '@/lib/phoneNormalize';
import { supabase } from '@/integrations/supabase/client';

export interface ContactCampaignRow {
  id: string | number;
  created_at: string;
  campaign_data: Record<string, any> | null;
}

/**
 * Builds every plausible digit-only variant of a phone: canonical (with 9),
 * legacy (without 9), with/without country code 55, and the raw digits.
 */
function buildPhoneVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const raw = String(phone).replace(/@.*/, '').replace(/\D/g, '');
  const canonical = normalizeBrPhone(phone);
  const set = new Set<string>();
  const push = (v?: string) => { if (v) set.add(v); };
  push(raw);
  push(canonical);
  for (const v of brPhoneVariants(phone)) push(v);
  for (const v of getBrPhoneVariants(raw)) push(v);
  for (const v of getBrPhoneVariants(canonical)) push(v);
  // Also without country code 55 (some registros gravam sem DDI)
  for (const v of [...set]) {
    if (v.startsWith('55') && v.length >= 12) set.add(v.slice(2));
  }
  return [...set].filter(Boolean);
}

/**
 * Fetches campaign ad records that originated the contact, matching by
 * phone (either `campaign_data.phone` or via `sessions.whatsapp_number`).
 * Returns [] when the contact was not brought in by any campaign.
 */
export function useContactCampaigns(phone: string | null | undefined) {
  const variants = buildPhoneVariants(phone);

  return useQuery({
    queryKey: ['contact-campaigns', variants],
    queryFn: async () => {
      if (variants.length === 0) return [] as ContactCampaignRow[];
      const query = `
        SELECT ca.id,
               ca.created_at,
               (ca.campaign_data::jsonb) AS campaign_data
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::bigint
         WHERE regexp_replace(
                 COALESCE(
                   NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                   s.whatsapp_number::text,
                   ''
                 ),
                 '\\D', '', 'g'
               ) = ANY($1::varchar[])
         ORDER BY ca.created_at DESC
         LIMIT 50
      `;
      const rows = await externalDb.raw<ContactCampaignRow>({
        query,
        params: [variants],
      });
      const out = rows || [];
      if (out.length === 0) {
        console.warn('[useContactCampaigns] no-match', { phone, variants });
      } else {
        console.info('[useContactCampaigns] lookup', { phone, variants, rowsFound: out.length });
      }
      return out;
    },
    enabled: variants.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export interface FirstInboundMessage {
  id: string;
  text: string | null;
  timestamp: string | null;
  conversation_id: string | null;
}

/**
 * Fetches the very first inbound message (from_me=false) the lead sent for
 * a given contact. Used to populate the "Frase do lead" block in the
 * Campanhas tab with the actual first chat message.
 */
export function useContactFirstInboundMessage(contactId: string | null | undefined) {
  return useQuery<FirstInboundMessage | null>({
    queryKey: ['contact-first-inbound', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, text, timestamp, conversation_id')
        .eq('contact_id', contactId)
        .eq('from_me', false)
        .not('text', 'is', null)
        .order('timestamp', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[useContactFirstInboundMessage] error', error);
        return null;
      }
      return (data as FirstInboundMessage) || null;
    },
    enabled: !!contactId,
    staleTime: 5 * 60_000,
  });
}