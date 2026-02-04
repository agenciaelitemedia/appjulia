import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampaignLeadItem } from '../types';
import { UnifiedFiltersState } from '@/components/filters/types';

export function useCampanhasLeadsList(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['campanhas-leads-list', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          ca.id,
          ca.cod_agent::text as cod_agent,
          ca.created_at,
          COALESCE(
            NULLIF(campaign_data->>'phone', ''),
            s.whatsapp_number::text
          ) as whatsapp,
          COALESCE(s.name, 'Sem nome') as contact_name,
          campaign_data->>'title' as campaign_title,
          campaign_data->>'sourceID' as campaign_id,
          COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
          campaign_data->>'greetingMessageBody' as greeting_message,
          COALESCE(c.name, 'Escritório') as office_name
        FROM campaing_ads ca
        LEFT JOIN sessions s ON s.id = ca.session_id::int
        LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
        LEFT JOIN clients c ON c.id = a.client_id
        WHERE ca.cod_agent::text = ANY($1::varchar[])
          AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ORDER BY ca.created_at DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignLeadItem>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
