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
          WITH crm_leads AS (
            SELECT c.id, c.cod_agent, c.whatsapp_number, c.stage_id
            FROM crm_atendimento_cards c
            WHERE c.cod_agent = ANY($1::varchar[])
              AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          julia_leads AS (
            SELECT DISTINCT cl.id, cl.stage_id
            FROM crm_leads cl
            WHERE EXISTS (
              SELECT 1 FROM vw_painelv2_desempenho_julia v
              WHERE v.cod_agent::text = cl.cod_agent
                AND v.whatsapp::text = cl.whatsapp_number
            )
          ),
          atendimentos AS (
            SELECT COUNT(DISTINCT v.session_id)::int as count
            FROM vw_painelv2_desempenho_julia v
            WHERE v.cod_agent::text = ANY($1::varchar[])
                AND (v.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
                AND (v.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          em_qualificacao AS (
            SELECT COUNT(*)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_stages s ON s.id = jl.stage_id
            WHERE s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
               OR LOWER(s.name) LIKE '%analise%caso%'
               OR LOWER(s.name) LIKE '%análise%caso%'
          ),
          qualificados AS (
            SELECT COUNT(*)::int as count
            FROM julia_leads jl
            JOIN crm_atendimento_stages s ON s.id = jl.stage_id
            WHERE s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
          ),
          contratos_gerados AS (
            SELECT COUNT(*)::int as count
            FROM vw_painelv2_desempenho_julia_contratos
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          contratos_assinados AS (
            SELECT COUNT(*)::int as count
            FROM vw_painelv2_desempenho_julia_contratos
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
              AND status_document = 'SIGNED'
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
          WITH campaign_contacts AS (
            SELECT DISTINCT
              ca.cod_agent::text AS cod_agent,
              COALESCE(
                NULLIF((ca.campaign_data::jsonb)->>'phone', ''),
                s.whatsapp_number::text
              ) AS whatsapp
            FROM campaing_ads ca
            LEFT JOIN sessions s ON s.id = ca.session_id::int
            WHERE ca.cod_agent::text = ANY($1::varchar[])
          ),
          campaign_leads AS (
            SELECT c.id, c.stage_id
            FROM crm_atendimento_cards c
            JOIN campaign_contacts cc
              ON cc.cod_agent = c.cod_agent
             AND cc.whatsapp = c.whatsapp_number
            WHERE c.cod_agent = ANY($1::varchar[])
              AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          stage_counts AS (
            SELECT
              COUNT(*) FILTER (
                WHERE s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
                   OR LOWER(s.name) LIKE '%analise%caso%'
                   OR LOWER(s.name) LIKE '%análise%caso%'
              )::int AS em_qualificacao,
              COUNT(*) FILTER (
                WHERE s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
              )::int AS qualificados
            FROM campaign_leads cl
            JOIN crm_atendimento_stages s ON s.id = cl.stage_id
          ),
          atendimentos AS (
            SELECT COUNT(DISTINCT v.session_id)::int AS count
            FROM vw_painelv2_desempenho_julia v
            JOIN campaign_contacts cc
              ON cc.cod_agent = v.cod_agent::text
             AND cc.whatsapp = v.whatsapp::text
            WHERE v.cod_agent::text = ANY($1::varchar[])
              AND (v.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (v.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ),
          contract_counts AS (
            SELECT
              COUNT(*)::int AS contratos_gerados,
              COUNT(*) FILTER (WHERE vc.status_document = 'SIGNED')::int AS contratos_assinados
            FROM vw_painelv2_desempenho_julia_contratos vc
            JOIN campaign_contacts cc
              ON cc.cod_agent = vc.cod_agent::text
             AND cc.whatsapp = vc.whatsapp::text
            WHERE vc.cod_agent::text = ANY($1::varchar[])
              AND (vc.data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (vc.data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          )
          SELECT 'Atendimentos' as stage_name, '#22c55e' as stage_color, 0 as position, (SELECT count FROM atendimentos) as count
          UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT em_qualificacao FROM stage_counts)
          UNION ALL SELECT 'Qualificados', '#f97316', 2, (SELECT qualificados FROM stage_counts)
          UNION ALL SELECT 'Contratos Gerados', '#3b82f6', 3, (SELECT contratos_gerados FROM contract_counts)
          UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT contratos_assinados FROM contract_counts)
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
