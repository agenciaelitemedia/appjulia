import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { getPreviousPeriod } from '@/lib/dateUtils';
import { 
  CampaignAd, 
  CampaignLead, 
  CampaignFunnelStage, 
  CampaignPlatformStats,
  CampaignEvolutionPoint,
  CampaignHeatmapCell,
  CampaignSummary,
  CampanhasFiltersState 
} from '../types';

interface CampanhaAgent {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
}

export function useCampanhasAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanhas-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return externalDb.getCrmAgentsForUser<CampanhaAgent>(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCampanhasLeads(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-leads', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          campaign_data->>'sourceID' as campaign_id,
          campaign_data->>'title' as campaign_title,
          COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
          COUNT(*)::int as total_leads,
          MIN(created_at) as first_lead,
          MAX(created_at) as last_lead
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          AND campaign_data->>'sourceID' IS NOT NULL
        GROUP BY campaign_id, campaign_title, platform
        ORDER BY total_leads DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignLead>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasRaw(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-raw', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          id, cod_agent::text, session_id, type, campaign_data, created_at
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ORDER BY created_at DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignAd>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasPrevious(filters: CampanhasFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);
  
  return useQuery({
    queryKey: ['campanhas-previous', filters.agentCodes, previousDateFrom, previousDateTo],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          id, 
          campaign_data->>'sourceID' as campaign_id,
          COALESCE(campaign_data->>'sourceApp', 'outros') as platform
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      `;
      
      const params = [agentCodes, previousDateFrom, previousDateTo];
      const result = await externalDb.raw<{ id: string; campaign_id: string; platform: string }>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasFunnel(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-funnel', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      // Query com 5 etapas definidas do funil de campanhas
      const query = `
        WITH campaign_leads AS (
          -- Todos os leads de campanhas no periodo
          SELECT DISTINCT
            ca.id,
            ca.cod_agent::text,
            COALESCE(
              NULLIF(campaign_data->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ),

        -- Etapa 1: Entrada (total de leads de campanhas)
        entrada AS (
          SELECT COUNT(*)::int as count FROM campaign_leads
        ),

        -- Etapa 2: Atendidos por JulIA (leads com registro em log_first_messages)
        atendidos AS (
          SELECT COUNT(DISTINCT cl.id)::int as count
          FROM campaign_leads cl
          WHERE EXISTS (
            SELECT 1 FROM log_first_messages lfm
            WHERE lfm.cod_agent::text = cl.cod_agent
              AND lfm.whatsapp::text = cl.whatsapp
          )
        ),

        -- Etapa 3: Em Qualificacao (leads que passaram por "Analise de Caso")
        em_qualificacao AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          JOIN crm_atendimento_history h ON h.card_id = c.id
          JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
          WHERE LOWER(s.name) LIKE '%analise%caso%' 
             OR LOWER(s.name) LIKE '%análise%caso%'
        ),

        -- IDs dos estagios de qualificacao
        qualified_stage_ids AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        ),

        -- Etapa 4: Qualificado (Negociacao + Contrato em Curso + Contrato Assinado)
        qualificado AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM qualified_stage_ids)
        ),

        -- ID do estagio "Contrato Assinado"
        cliente_stage_id AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name = 'Contrato Assinado'
        ),

        -- Etapa 5: Cliente (apenas Contrato Assinado)
        cliente AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM cliente_stage_id)
        )

        -- Resultado final do funil
        SELECT 'Entrada' as stage_name, '#3b82f6' as stage_color, 0 as position, (SELECT count FROM entrada) as count
        UNION ALL
        SELECT 'Atendidos por JulIA', '#22c55e', 1, (SELECT count FROM atendidos)
        UNION ALL
        SELECT 'Em Qualificação', '#eab308', 2, (SELECT count FROM em_qualificacao)
        UNION ALL
        SELECT 'Qualificado', '#f97316', 3, (SELECT count FROM qualificado)
        UNION ALL
        SELECT 'Cliente', '#8b5cf6', 4, (SELECT count FROM cliente)
        ORDER BY position
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      
      try {
        const result = await externalDb.raw<{ stage_name: string; stage_color: string; position: number; count: number }>({ query, params });
        
        // Calcular percentuais e taxas de conversão
        const firstCount = result.length > 0 ? result[0].count : 0;
        
        return result.map((stage, index) => ({
          ...stage,
          percentage: firstCount > 0 ? (stage.count / firstCount) * 100 : 0,
          conversionRate: index > 0 && result[index - 1].count > 0 
            ? (stage.count / result[index - 1].count) * 100 
            : 100,
        })) as CampaignFunnelStage[];
      } catch (error) {
        console.error('Error fetching funnel data:', error);
        return [];
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Hook para buscar dados do funil do período anterior (para comparação)
export function useCampanhasFunnelPrevious(filters: CampanhasFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);
  
  return useQuery({
    queryKey: ['campanhas-funnel-previous', filters.agentCodes, previousDateFrom, previousDateTo],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      // Mesma query do funil, mas com datas do período anterior
      const query = `
        WITH campaign_leads AS (
          SELECT DISTINCT
            ca.id,
            ca.cod_agent::text,
            COALESCE(
              NULLIF(campaign_data->>'phone', ''),
              s.whatsapp_number::text
            ) as whatsapp
          FROM campaing_ads ca
          LEFT JOIN sessions s ON s.id = ca.session_id::int
          WHERE ca.cod_agent::text = ANY($1::varchar[])
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (ca.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ),
        entrada AS (
          SELECT COUNT(*)::int as count FROM campaign_leads
        ),
        atendidos AS (
          SELECT COUNT(DISTINCT cl.id)::int as count
          FROM campaign_leads cl
          WHERE EXISTS (
            SELECT 1 FROM log_first_messages lfm
            WHERE lfm.cod_agent::text = cl.cod_agent
              AND lfm.whatsapp::text = cl.whatsapp
          )
        ),
        em_qualificacao AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          JOIN crm_atendimento_history h ON h.card_id = c.id
          JOIN crm_atendimento_stages s ON s.id = h.to_stage_id
          WHERE LOWER(s.name) LIKE '%analise%caso%' 
             OR LOWER(s.name) LIKE '%análise%caso%'
        ),
        qualified_stage_ids AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
        ),
        qualificado AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM qualified_stage_ids)
        ),
        cliente_stage_id AS (
          SELECT id FROM crm_atendimento_stages 
          WHERE name = 'Contrato Assinado'
        ),
        cliente AS (
          SELECT COUNT(DISTINCT c.id)::int as count
          FROM campaign_leads cl
          JOIN crm_atendimento_cards c 
            ON c.cod_agent = cl.cod_agent 
            AND c.whatsapp_number = cl.whatsapp
          WHERE c.stage_id IN (SELECT id FROM cliente_stage_id)
        )
        SELECT 'Entrada' as stage_name, 0 as position, (SELECT count FROM entrada) as count
        UNION ALL
        SELECT 'Atendidos por JulIA', 1, (SELECT count FROM atendidos)
        UNION ALL
        SELECT 'Em Qualificação', 2, (SELECT count FROM em_qualificacao)
        UNION ALL
        SELECT 'Qualificado', 3, (SELECT count FROM qualificado)
        UNION ALL
        SELECT 'Cliente', 4, (SELECT count FROM cliente)
        ORDER BY position
      `;
      
      const params = [agentCodes, previousDateFrom, previousDateTo];
      
      try {
        const result = await externalDb.raw<{ stage_name: string; position: number; count: number }>({ query, params });
        return result;
      } catch (error) {
        console.error('Error fetching previous funnel data:', error);
        return [];
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasByPlatform(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-by-platform', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
          COUNT(*)::int as total_leads
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        GROUP BY platform
        ORDER BY total_leads DESC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<{ platform: string; total_leads: number }>({ query, params });
      
      const total = result.reduce((acc, r) => acc + r.total_leads, 0);
      
      return result.map(r => ({
        ...r,
        percentage: total > 0 ? (r.total_leads / total) * 100 : 0,
      })) as CampaignPlatformStats[];
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasEvolution(filters: CampanhasFiltersState) {
  // Verificar se é um único dia para usar granularidade por hora
  const isSingleDay = filters.dateFrom === filters.dateTo;
  
  return useQuery({
    queryKey: ['campanhas-evolution', filters, isSingleDay],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      // Query diferente para período de 1 dia (por hora) vs múltiplos dias (por data)
      const query = isSingleDay 
        ? `
          SELECT 
            EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
            NULL as date,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'facebook')::int as facebook,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'instagram')::int as instagram,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'google')::int as google,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(campaign_data->>'sourceApp', 'outros')) NOT IN ('facebook', 'instagram', 'google'))::int as outros
          FROM campaing_ads
          WHERE cod_agent::text = ANY($1::varchar[])
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date
          GROUP BY hour
          ORDER BY hour ASC
        `
        : `
          SELECT 
            NULL as hour,
            (created_at AT TIME ZONE 'America/Sao_Paulo')::date::text as date,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'facebook')::int as facebook,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'instagram')::int as instagram,
            COUNT(*) FILTER (WHERE LOWER(campaign_data->>'sourceApp') = 'google')::int as google,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(campaign_data->>'sourceApp', 'outros')) NOT IN ('facebook', 'instagram', 'google'))::int as outros
          FROM campaing_ads
          WHERE cod_agent::text = ANY($1::varchar[])
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          GROUP BY date
          ORDER BY date ASC
        `;
      
      const params = isSingleDay 
        ? [agentCodes, dateFrom] 
        : [agentCodes, dateFrom, dateTo];
        
      const result = await externalDb.raw<CampaignEvolutionPoint & { hour?: number }>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCampanhasHeatmap(filters: CampanhasFiltersState) {
  return useQuery({
    queryKey: ['campanhas-heatmap', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
          EXTRACT(DOW FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as day,
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
          COUNT(*)::int as count
        FROM campaing_ads
        WHERE cod_agent::text = ANY($1::varchar[])
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
          AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        GROUP BY day, hour
        ORDER BY day, hour
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignHeatmapCell>({ query, params });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Hook para calcular o resumo/summary - agora importado de useCampanhasSummary.ts
export { useCampanhasSummaryData as useCampanhasSummary } from './useCampanhasSummary';
