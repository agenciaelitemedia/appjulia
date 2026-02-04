import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampaignLeadItem } from '../types';
import { UnifiedFiltersState } from '@/components/filters/types';

interface LeadsListFilters extends UnifiedFiltersState {
  campaignId?: string;
}

export function useCampanhasLeadsList(filters: LeadsListFilters) {
  return useQuery({
    queryKey: ['campanhas-leads-list', filters.agentCodes, filters.dateFrom, filters.dateTo, filters.campaignId],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo, campaignId } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        WITH campaign_leads AS (
          SELECT 
            ca.id,
            ca.cod_agent::text as cod_agent,
            ca.created_at,
            COALESCE(
              NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp,
            (ca.campaign_data::jsonb)->>'title' as campaign_title,
            (ca.campaign_data::jsonb)->>'sourceID' as campaign_id,
            COALESCE((ca.campaign_data::jsonb)->>'sourceApp', 'outros') as platform,
            (ca.campaign_data::jsonb)->>'greetingMessageBody' as greeting_message,
            COALESCE(c.name, 'Escritório') as office_name
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
          LEFT JOIN clients c ON c.id = a.client_id
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
            AND ($4::text IS NULL OR (ca.campaign_data::jsonb)->>'sourceID' = $4)
        )
        SELECT 
          cl.id,
          cl.cod_agent,
          cl.created_at,
          cl.whatsapp,
          COALESCE(crm.contact_name, 'Sem nome') as contact_name,
          cl.campaign_title,
          cl.campaign_id,
          cl.platform,
          cl.greeting_message,
          cl.office_name
        FROM campaign_leads cl
        LEFT JOIN crm_atendimento_cards crm 
          ON crm.whatsapp_number::text = cl.whatsapp 
          AND crm.cod_agent = cl.cod_agent
        ORDER BY cl.created_at DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo, campaignId || null];
      const result = await externalDb.raw<CampaignLeadItem>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
