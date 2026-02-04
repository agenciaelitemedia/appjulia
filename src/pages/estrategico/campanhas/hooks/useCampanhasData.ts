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
      
      // Query com JOINs via sessions para relacionar campanhas com CRM
      const query = `
        WITH campaign_sessions AS (
          -- Relacionar campanhas com sessions via session_id
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
        campaign_leads_in_crm AS (
          -- Encontrar cards do CRM que vieram de campanhas
          SELECT 
            c.id,
            c.stage_id,
            c.whatsapp_number,
            c.cod_agent
          FROM crm_atendimento_cards c
          WHERE EXISTS (
            SELECT 1 FROM campaign_sessions cs 
            WHERE cs.whatsapp_number = c.whatsapp_number::text
              AND cs.cod_agent = c.cod_agent
          )
        ),
        funnel_stages AS (
          -- Agregar por estágio
          SELECT 
            s.name as stage_name,
            s.color as stage_color,
            s.position,
            COUNT(cl.id)::int as count
          FROM crm_atendimento_stages s
          LEFT JOIN campaign_leads_in_crm cl ON cl.stage_id = s.id
          WHERE s.is_active = true
          GROUP BY s.id, s.name, s.color, s.position
        )
        SELECT * FROM funnel_stages
        WHERE count > 0
        ORDER BY position ASC
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      
      try {
        const result = await externalDb.raw<{ stage_name: string; stage_color: string; position: number; count: number }>({ query, params });
        
        // Se a query principal retornar vazio, usar fallback simplificado
        if (result.length === 0) {
          return await getFallbackFunnel(agentCodes, dateFrom, dateTo);
        }
        
        // Calcular percentuais e taxas de conversão
        const maxCount = result.length > 0 ? Math.max(...result.map(r => r.count)) : 0;
        
        return result.map((stage, index) => ({
          ...stage,
          percentage: maxCount > 0 ? (stage.count / maxCount) * 100 : 0,
          conversionRate: index > 0 && result[index - 1].count > 0 
            ? (stage.count / result[index - 1].count) * 100 
            : 100,
        })) as CampaignFunnelStage[];
      } catch (error) {
        console.error('Error fetching funnel data:', error);
        // Em caso de erro, usar fallback
        return await getFallbackFunnel(agentCodes, dateFrom, dateTo);
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Fallback simplificado baseado apenas em campaing_ads
async function getFallbackFunnel(agentCodes: string[], dateFrom: string, dateTo: string): Promise<CampaignFunnelStage[]> {
  const query = `
    WITH campaign_data AS (
      SELECT 
        id,
        session_id,
        campaign_data->>'entryPointConversionSource' as conversion_source
      FROM campaing_ads
      WHERE cod_agent::text = ANY($1::varchar[])
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
    )
    SELECT 
      'Leads Captados' as stage_name,
      '#3b82f6' as stage_color,
      0 as position,
      COUNT(*)::int as count
    FROM campaign_data
    UNION ALL
    SELECT 
      'Com Sessão' as stage_name,
      '#22c55e' as stage_color,
      1 as position,
      COUNT(DISTINCT session_id)::int as count
    FROM campaign_data
    WHERE session_id IS NOT NULL
    UNION ALL
    SELECT 
      'Ads Diretos' as stage_name,
      '#eab308' as stage_color,
      2 as position,
      COUNT(*)::int as count
    FROM campaign_data
    WHERE conversion_source = 'ctwa_ad'
    ORDER BY position
  `;
  
  try {
    const result = await externalDb.raw<{ stage_name: string; stage_color: string; position: number; count: number }>({ query, params: [agentCodes, dateFrom, dateTo] });
    const maxCount = result.length > 0 ? Math.max(...result.map(r => r.count)) : 0;
    
    return result.map((stage, index) => ({
      ...stage,
      percentage: maxCount > 0 ? (stage.count / maxCount) * 100 : 0,
      conversionRate: index > 0 && result[index - 1].count > 0 
        ? (stage.count / result[index - 1].count) * 100 
        : 100,
    })) as CampaignFunnelStage[];
  } catch {
    return [];
  }
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
  return useQuery({
    queryKey: ['campanhas-evolution', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const query = `
        SELECT 
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
      
      const params = [agentCodes, dateFrom, dateTo];
      const result = await externalDb.raw<CampaignEvolutionPoint>({ query, params });
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
