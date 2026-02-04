import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { CampanhasFiltersState } from '../types';

export interface ConversionEvolutionPoint {
  date: string;
  total_leads: number;
  qualified_leads: number;
  conversion_rate: number;
}

export function useCampanhasConversionEvolution(filters: CampanhasFiltersState) {
  const isSingleDay = filters.dateFrom === filters.dateTo;
  
  return useQuery({
    queryKey: ['campanhas-conversion-evolution', filters, isSingleDay],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      // Query para granularidade por hora (único dia) ou por dia
      const groupBy = isSingleDay 
        ? "EXTRACT(HOUR FROM ca.created_at AT TIME ZONE 'America/Sao_Paulo')::int"
        : "(ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text";
      
      const query = `
        WITH campaign_leads_by_period AS (
          SELECT 
            ${groupBy} as period,
            COUNT(*)::int as total_leads,
            s.whatsapp_number::text as whatsapp,
            a.cod_agent::text as agent_code
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          LEFT JOIN agents a ON a.id = s.agent_id
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          GROUP BY period, whatsapp, agent_code
        ),
        leads_totals AS (
          SELECT 
            period,
            SUM(total_leads)::int as total_leads
          FROM campaign_leads_by_period
          GROUP BY period
        ),
        qualified_stages AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        ),
        qualified_by_period AS (
          SELECT 
            clp.period,
            COUNT(DISTINCT c.id)::int as qualified_count
          FROM campaign_leads_by_period clp
          JOIN crm_atendimento_cards c ON c.whatsapp_number::text = clp.whatsapp AND c.cod_agent = clp.agent_code
          WHERE c.stage_id IN (SELECT id FROM qualified_stages)
          GROUP BY clp.period
        )
        SELECT 
          lt.period::text as date,
          lt.total_leads,
          COALESCE(qp.qualified_count, 0)::int as qualified_leads,
          CASE 
            WHEN lt.total_leads > 0 
            THEN ROUND((COALESCE(qp.qualified_count, 0)::numeric / lt.total_leads) * 100, 1)
            ELSE 0 
          END as conversion_rate
        FROM leads_totals lt
        LEFT JOIN qualified_by_period qp ON qp.period = lt.period
        ORDER BY lt.period ASC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      
      try {
        const result = await externalDb.raw<ConversionEvolutionPoint>({ query, params });
        return result;
      } catch (error) {
        console.error('Error fetching conversion evolution:', error);
        return [];
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}
