import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampanhasFiltersState, CampaignFunnelData } from '../types';

export function useCampaignsFunnelByGroup(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campaigns-funnel-by-group', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const query = `
        WITH campaign_leads AS (
          SELECT 
            ((campaign_data::jsonb)->>'sourceID') || '::' || 
            ((campaign_data::jsonb)->>'title') as group_key,
            ca.id,
            ca.cod_agent::text,
            COALESCE(
              NULLIF((campaign_data::jsonb)->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          WHERE ca.cod_agent::text = ANY($1::text[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
            AND (campaign_data::jsonb)->>'sourceID' IS NOT NULL
        ),

        entrada AS (
          SELECT group_key, COUNT(*)::int as count
          FROM campaign_leads
          GROUP BY group_key
        ),

        atendidos AS (
          SELECT 
            cl.group_key,
            COUNT(DISTINCT cl.id)::int as count
          FROM campaign_leads cl
          WHERE EXISTS (
            SELECT 1 FROM log_first_messages lfm
            WHERE lfm.cod_agent::text = cl.cod_agent
              AND lfm.whatsapp::text = cl.whatsapp
          )
          GROUP BY cl.group_key
        ),

        em_qualificacao AS (
          SELECT 
            cl.group_key,
            COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          JOIN crm_atendimento_history h ON h.card_id = c.id
          JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
          WHERE LOWER(s.name) LIKE '%analise%caso%' 
             OR LOWER(s.name) LIKE '%análise%caso%'
          GROUP BY cl.group_key
        ),

        qualified_stage_ids AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        ),

        qualificado AS (
          SELECT 
            cl.group_key,
            COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM qualified_stage_ids)
          GROUP BY cl.group_key
        ),

        cliente_stage_id AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name = 'Contrato Assinado'
        ),

        cliente AS (
          SELECT 
            cl.group_key,
            COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM cliente_stage_id)
          GROUP BY cl.group_key
        )

        SELECT 
          e.group_key,
          e.count as total_leads,
          COALESCE(a.count, 0)::int as atendidos,
          COALESCE(eq.count, 0)::int as em_qualificacao,
          COALESCE(q.count, 0)::int as qualificado,
          COALESCE(c.count, 0)::int as cliente
        FROM entrada e
        LEFT JOIN atendidos a ON a.group_key = e.group_key
        LEFT JOIN em_qualificacao eq ON eq.group_key = e.group_key
        LEFT JOIN qualificado q ON q.group_key = e.group_key
        LEFT JOIN cliente c ON c.group_key = e.group_key
      `;

      const result = await externalDb.raw<CampaignFunnelData>({
        query,
        params: [
          filters.agentCodes,
          filters.dateFrom,
          filters.dateTo
        ]
      });

      return result;
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
