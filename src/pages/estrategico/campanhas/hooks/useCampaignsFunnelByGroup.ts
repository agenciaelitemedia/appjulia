import { useQuery } from '@tanstack/react-query';
import { queryExternalDb } from '@/lib/externalDb';
import { CampanhasFiltersState, CampaignFunnelData } from '../types';

export function useCampaignsFunnelByGroup(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campaigns-funnel-by-group', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const query = `
        WITH campaign_leads AS (
          SELECT 
            campaign_data->>'sourceID' || '::' || campaign_data->>'title' as group_key,
            ca.cod_agent::text,
            COALESCE(
              NULLIF(campaign_data->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          WHERE ca.cod_agent::text = ANY($1)
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
            AND campaign_data->>'sourceID' IS NOT NULL
        ),
        
        unique_leads AS (
          SELECT DISTINCT group_key, cod_agent, whatsapp
          FROM campaign_leads
          WHERE whatsapp IS NOT NULL
        ),
        
        lead_counts AS (
          SELECT group_key, COUNT(*) as total_leads
          FROM campaign_leads
          GROUP BY group_key
        ),
        
        qualified_stages AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        ),
        
        cliente_stage AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name = 'Contrato Assinado'
        ),
        
        crm_matches AS (
          SELECT 
            ul.group_key,
            c.id as card_id,
            c.stage_id
          FROM unique_leads ul
          INNER JOIN crm_atendimento_cards c 
            ON c.cod_agent = ul.cod_agent 
            AND c.whatsapp_number = ul.whatsapp
        )
        
        SELECT 
          lc.group_key,
          lc.total_leads::int,
          COUNT(DISTINCT CASE WHEN cm.stage_id IN (SELECT id FROM qualified_stages) 
                              THEN cm.card_id END)::int as qualified,
          COUNT(DISTINCT CASE WHEN cm.stage_id IN (SELECT id FROM cliente_stage) 
                              THEN cm.card_id END)::int as clients
        FROM lead_counts lc
        LEFT JOIN crm_matches cm ON cm.group_key = lc.group_key
        GROUP BY lc.group_key, lc.total_leads
      `;

      const result = await queryExternalDb<CampaignFunnelData>(query, [
        filters.agentCodes,
        filters.dateFrom,
        filters.dateTo
      ]);

      return result;
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
