import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampaignDetailGrouped, CampanhasFiltersState, CampaignSource } from '../types';

interface RawCampaignData {
  campaign_id: string;
  campaign_title: string;
  campaign_body: string;
  thumbnail_url: string;
  media_url: string;
  total_leads: number;
  first_lead: string;
  last_lead: string;
  platforms: string[];
  devices: string[];
  sources: CampaignSource[];
  cod_agent: string;
  office_name: string;
}

export function useCampanhasDetails(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-details-grouped', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        WITH campaign_sources AS (
          SELECT 
            campaign_data->>'sourceID' as campaign_id,
            campaign_data->>'title' as campaign_title,
            campaign_data->>'body' as campaign_body,
            COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
            campaign_data->>'sourceURL' as source_url,
            campaign_data->>'mediaURL' as media_url,
            COALESCE(campaign_data->>'thumbnailURL', campaign_data->>'thumbnail') as thumbnail_url,
            campaign_data->>'greetingMessageBody' as greeting_message,
            COALESCE(campaign_data->>'sourceDevice', 'unknown') as device,
            ca.created_at,
            ca.cod_agent::text as cod_agent,
            COALESCE(c.name, 'Escritório') as office_name
          FROM campaing_ads ca
          LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
          LEFT JOIN clients c ON c.id = a.client_id
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
            AND campaign_data->>'sourceID' IS NOT NULL
        )
        SELECT 
          campaign_id,
          campaign_title,
          MAX(campaign_body) as campaign_body,
          MAX(thumbnail_url) as thumbnail_url,
          MAX(media_url) as media_url,
          COUNT(*)::int as total_leads,
          MIN(created_at) as first_lead,
          MAX(created_at) as last_lead,
          cod_agent,
          office_name,
          ARRAY_AGG(DISTINCT platform) as platforms,
          ARRAY_AGG(DISTINCT device) FILTER (WHERE device IS NOT NULL AND device != 'unknown') as devices,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'source_url', source_url,
              'platform', platform,
              'greeting_message', greeting_message,
              'device', device,
              'created_at', created_at
            ) ORDER BY created_at DESC
          ) as sources
        FROM campaign_sources
        GROUP BY campaign_id, campaign_title, cod_agent, office_name
        ORDER BY total_leads DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<RawCampaignData>({ query, params });
      
      // Process the result to add last_greeting_message and last_source_url
      return result.map((item): CampaignDetailGrouped => {
        const sources = Array.isArray(item.sources) ? item.sources : [];
        const lastSource = sources[0];
        
        return {
          campaign_id: item.campaign_id,
          campaign_title: item.campaign_title,
          campaign_body: item.campaign_body,
          thumbnail_url: item.thumbnail_url,
          media_url: item.media_url,
          total_leads: item.total_leads,
          first_lead: item.first_lead,
          last_lead: item.last_lead,
          platforms: item.platforms || [],
          devices: item.devices || [],
          sources: sources,
          last_greeting_message: lastSource?.greeting_message || '',
          last_source_url: lastSource?.source_url || '',
          cod_agent: item.cod_agent,
          office_name: item.office_name,
        };
      });
    },
    enabled: filters.agentCodes.length > 0,
  });
}
