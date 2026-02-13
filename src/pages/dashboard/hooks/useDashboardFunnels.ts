import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import type { UnifiedFiltersState } from '@/components/filters/types';

export interface DashboardFunnelStage {
  stage_name: string;
  stage_color: string;
  position: number;
  count: number;
  percentage: number;
  conversionRate: number;
}

interface RawFunnelRow {
  stage_name: string;
  stage_color: string;
  position: number;
  count: number;
}

function toFunnelStages(rows: RawFunnelRow[]): DashboardFunnelStage[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const first = sorted[0]?.count || 0;

  return sorted.map((row, i) => ({
    stage_name: row.stage_name,
    stage_color: row.stage_color,
    position: row.position,
    count: Number(row.count) || 0,
    percentage: first > 0 ? ((Number(row.count) || 0) / first) * 100 : 0,
    conversionRate:
      i === 0
        ? 100
        : sorted[i - 1].count > 0
        ? ((Number(row.count) || 0) / Number(sorted[i - 1].count)) * 100
        : 0,
  }));
}

export function useDashboardJuliaFunnel(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['dashboard-julia-funnel', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const result = await externalDb.raw<RawFunnelRow>({
        query: `
          WITH julia_leads AS (
            SELECT DISTINCT whatsapp::text as whatsapp, cod_agent::text as cod_agent
            FROM vw_desempenho_julia
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          atendimentos AS (
            SELECT COUNT(DISTINCT whatsapp)::int as count FROM julia_leads
          ),
          em_qualificacao AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages
              WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
            )
          ),
          qualificados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Negociação'
            )
          ),
          contratos_gerados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso'
            )
          ),
          contratos_assinados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_cards c ON c.cod_agent = jl.cod_agent AND c.whatsapp_number = jl.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato Assinado'
            )
          )
          SELECT 'Atendimentos' as stage_name, '#22c55e' as stage_color, 0 as position, (SELECT count FROM atendimentos) as count
          UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT count FROM em_qualificacao)
          UNION ALL SELECT 'Qualificados', '#f97316', 2, (SELECT count FROM qualificados)
          UNION ALL SELECT 'Contratos Gerados', '#3b82f6', 3, (SELECT count FROM contratos_gerados)
          UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT count FROM contratos_assinados)
          ORDER BY position
        `,
        params: [filters.agentCodes, filters.dateFrom, filters.dateTo],
      });

      return toFunnelStages(result);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardCampaignFunnel(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['dashboard-campaign-funnel', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const result = await externalDb.raw<RawFunnelRow>({
        query: `
          WITH campaign_leads AS (
            SELECT DISTINCT
              ca.id,
              ca.cod_agent::text as cod_agent,
              COALESCE(
                NULLIF((campaign_data::jsonb)->>'phone', ''),
                s.whatsapp_number::text
              ) as whatsapp
            FROM campaing_ads ca
            LEFT JOIN sessions s ON s.id = ca.session_id::int
            WHERE ca.cod_agent::text = ANY($1::text[])
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
              AND COALESCE(
                NULLIF((campaign_data::jsonb)->>'phone', ''),
                s.whatsapp_number::text
              ) IS NOT NULL
          ),
          entrada AS (
            SELECT COUNT(DISTINCT whatsapp)::int as count FROM campaign_leads
          ),
          em_qualificacao AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM campaign_leads cl
            JOIN crm_atendimento_cards c ON c.cod_agent = cl.cod_agent AND c.whatsapp_number = cl.whatsapp
            JOIN crm_atendimento_stages st ON st.id = c.stage_id
            WHERE st.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages
              WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
            )
          ),
          qualificados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM campaign_leads cl
            JOIN crm_atendimento_cards c ON c.cod_agent = cl.cod_agent AND c.whatsapp_number = cl.whatsapp
            JOIN crm_atendimento_stages st ON st.id = c.stage_id
            WHERE st.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Negociação'
            )
          ),
          contratos_gerados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM campaign_leads cl
            JOIN crm_atendimento_cards c ON c.cod_agent = cl.cod_agent AND c.whatsapp_number = cl.whatsapp
            JOIN crm_atendimento_stages st ON st.id = c.stage_id
            WHERE st.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso'
            )
          ),
          contratos_assinados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM campaign_leads cl
            JOIN crm_atendimento_cards c ON c.cod_agent = cl.cod_agent AND c.whatsapp_number = cl.whatsapp
            JOIN crm_atendimento_stages st ON st.id = c.stage_id
            WHERE st.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato Assinado'
            )
          )
          SELECT 'Atendimentos' as stage_name, '#22c55e' as stage_color, 0 as position, (SELECT count FROM entrada) as count
          UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT count FROM em_qualificacao)
          UNION ALL SELECT 'Qualificados', '#f97316', 2, (SELECT count FROM qualificados)
          UNION ALL SELECT 'Contratos Gerados', '#3b82f6', 3, (SELECT count FROM contratos_gerados)
          UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT count FROM contratos_assinados)
          ORDER BY position
        `,
        params: [filters.agentCodes, filters.dateFrom, filters.dateTo],
      });

      return toFunnelStages(result);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardOrganicFunnel(filters: UnifiedFiltersState) {
  return useQuery({
    queryKey: ['dashboard-organic-funnel', filters.agentCodes, filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const result = await externalDb.raw<RawFunnelRow>({
        query: `
          WITH julia_leads AS (
            SELECT DISTINCT whatsapp::text as whatsapp, cod_agent::text as cod_agent
            FROM vw_desempenho_julia
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          campaign_whatsapp AS (
            SELECT DISTINCT COALESCE(
              NULLIF((campaign_data::jsonb)->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
            FROM campaing_ads ca
            LEFT JOIN sessions s ON s.id = ca.session_id::int
            WHERE ca.cod_agent::text = ANY($1::text[])
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2
              AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3
              AND COALESCE(
                NULLIF((campaign_data::jsonb)->>'phone', ''),
                s.whatsapp_number::text
              ) IS NOT NULL
          ),
          organic_leads AS (
            SELECT DISTINCT whatsapp, cod_agent
            FROM julia_leads
            WHERE whatsapp NOT IN (SELECT whatsapp FROM campaign_whatsapp)
          ),
          atendimentos AS (
            SELECT COUNT(DISTINCT whatsapp)::int as count FROM organic_leads
          ),
          em_qualificacao AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM organic_leads ol
            JOIN crm_atendimento_cards c ON c.cod_agent = ol.cod_agent AND c.whatsapp_number = ol.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages
              WHERE LOWER(name) LIKE '%analise%caso%' OR LOWER(name) LIKE '%análise%caso%'
            )
          ),
          qualificados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM organic_leads ol
            JOIN crm_atendimento_cards c ON c.cod_agent = ol.cod_agent AND c.whatsapp_number = ol.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Negociação'
            )
          ),
          contratos_gerados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM organic_leads ol
            JOIN crm_atendimento_cards c ON c.cod_agent = ol.cod_agent AND c.whatsapp_number = ol.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato em Curso'
            )
          ),
          contratos_assinados AS (
            SELECT COUNT(DISTINCT c.id)::int as count
            FROM organic_leads ol
            JOIN crm_atendimento_cards c ON c.cod_agent = ol.cod_agent AND c.whatsapp_number = ol.whatsapp
            JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE s.position >= (
              SELECT MIN(position) FROM crm_atendimento_stages WHERE name = 'Contrato Assinado'
            )
          )
          SELECT 'Atendimentos' as stage_name, '#22c55e' as stage_color, 0 as position, (SELECT count FROM atendimentos) as count
          UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT count FROM em_qualificacao)
          UNION ALL SELECT 'Qualificados', '#f97316', 2, (SELECT count FROM qualificados)
          UNION ALL SELECT 'Contratos Gerados', '#3b82f6', 3, (SELECT count FROM contratos_gerados)
          UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT count FROM contratos_assinados)
          ORDER BY position
        `,
        params: [filters.agentCodes, filters.dateFrom, filters.dateTo],
      });

      return toFunnelStages(result);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
