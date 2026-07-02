import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface ContactCampaignRow {
  id: string | number;
  created_at: string;
  campaign_data: Record<string, any> | null;
}

/**
 * Fetches campaign ad records that originated the contact, matching by
 * phone (either `campaign_data.phone` or via `sessions.whatsapp_number`).
 * Returns [] when the contact was not brought in by any campaign.
 */
export function useContactCampaigns(phone: string | null | undefined) {
  const variants = (() => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return [] as string[];
    return getBrPhoneVariants(digits);
  })();

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
         WHERE COALESCE(
                 NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                 s.whatsapp_number::text
               ) = ANY($1::varchar[])
         ORDER BY ca.created_at DESC
         LIMIT 50
      `;
      const rows = await externalDb.raw<ContactCampaignRow>({
        query,
        params: [variants],
      });
      return rows || [];
    },
    enabled: variants.length > 0,
    staleTime: 5 * 60_000,
  });
}