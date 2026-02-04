import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { UnifiedFiltersState } from '@/components/filters/types';

export interface CampaignOption {
  campaign_id: string;
  campaign_title: string;
  lead_count: number;
}

export function useCampanhasOptions(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['campanhas-options', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          (campaign_data::jsonb)->>'sourceID' as campaign_id,
          (campaign_data::jsonb)->>'title' as campaign_title,
          COUNT(*)::int as lead_count
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
        GROUP BY campaign_id, campaign_title
        ORDER BY lead_count DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignOption>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
