import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { CampanhasFiltersState } from '../types';

interface QualifiedResult {
  qualified_count: number;
}

export function useCampanhasQualified(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-qualified', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return { qualified_count: 0 };
      
      const query = `
        WITH campaign_sessions AS (
          SELECT DISTINCT 
            s.whatsapp_number::text,
            a.cod_agent::text
          FROM campaing_ads ca
          JOIN sessions s ON s.id = ca.session_id::int
          JOIN agents a ON a.id = s.agent_id
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ),
        qualified_stages AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        )
        SELECT COUNT(DISTINCT c.id)::int as qualified_count
        FROM crm_atendimento_cards c
        WHERE c.stage_id IN (SELECT id FROM qualified_stages)
          AND EXISTS (
            SELECT 1 FROM campaign_sessions cs 
            WHERE cs.whatsapp_number = c.whatsapp_number::text
              AND cs.cod_agent = c.cod_agent
          )
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      
      try {
        const result = await externalDb.raw<QualifiedResult>({ query, params });
        return result[0] || { qualified_count: 0 };
      } catch (error) {
        console.error('Error fetching qualified leads:', error);
        return { qualified_count: 0 };
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasQualifiedPrevious(filters: CampanhasFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);
  
  return useQuery({
    queryKey: ['campanhas-qualified-previous', filters.agentCodes, previousDateFrom, previousDateTo],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return { qualified_count: 0 };
      
      const query = `
        WITH campaign_sessions AS (
          SELECT DISTINCT 
            s.whatsapp_number::text,
            a.cod_agent::text
          FROM campaing_ads ca
          JOIN sessions s ON s.id = ca.session_id::int
          JOIN agents a ON a.id = s.agent_id
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ),
        qualified_stages AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        )
        SELECT COUNT(DISTINCT c.id)::int as qualified_count
        FROM crm_atendimento_cards c
        WHERE c.stage_id IN (SELECT id FROM qualified_stages)
          AND EXISTS (
            SELECT 1 FROM campaign_sessions cs 
            WHERE cs.whatsapp_number = c.whatsapp_number::text
              AND cs.cod_agent = c.cod_agent
          )
      `;
      
      const params = [agentCodes, previousDateFrom, previousDateTo];
      
      try {
        const result = await externalDb.raw<QualifiedResult>({ query, params });
        return result[0] || { qualified_count: 0 };
      } catch (error) {
        console.error('Error fetching previous qualified leads:', error);
        return { qualified_count: 0 };
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}
