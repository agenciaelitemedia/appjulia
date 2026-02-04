import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampaignDetail, CampanhasFiltersState } from '../types';

export function useCampanhasDetails(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-details', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          campaign_data->>'sourceID' as campaign_id,
          campaign_data->>'title' as campaign_title,
          campaign_data->>'body' as campaign_body,
          COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
          campaign_data->>'sourceURL' as source_url,
          campaign_data->>'mediaURL' as media_url,
          COALESCE(campaign_data->>'thumbnailURL', campaign_data->>'thumbnail') as thumbnail_url,
          campaign_data->>'conversionSource' as conversion_source,
          campaign_data->>'greetingMessageBody' as greeting_message,
          COUNT(*)::int as total_leads,
          MIN(ca.created_at) as first_lead,
          MAX(ca.created_at) as last_lead,
          ca.cod_agent::text as cod_agent,
          COALESCE(c.name, 'Escritório') as office_name
        FROM campaing_ads ca
        LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
        LEFT JOIN clients c ON c.id = a.client_id
        WHERE ca.cod_agent::text = ANY($1::varchar[])
          AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          AND campaign_data->>'sourceID' IS NOT NULL
        GROUP BY 
          campaign_id, campaign_title, campaign_body, platform,
          source_url, media_url, thumbnail_url, conversion_source, greeting_message,
          ca.cod_agent, c.name
        ORDER BY total_leads DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignDetail>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
