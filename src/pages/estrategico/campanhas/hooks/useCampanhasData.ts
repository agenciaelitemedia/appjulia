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
      
      // Query para buscar leads de campanhas por estágio do CRM
      const query = `
        WITH campaign_sessions AS (
          SELECT DISTINCT session_id
          FROM campaing_ads
          WHERE cod_agent::text = ANY($1::varchar[])
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        ),
        funnel_data AS (
          SELECT 
            s.name as stage_name,
            s.color as stage_color,
            s.position,
            COUNT(DISTINCT c.id) as count
          FROM crm_atendimento_stages s
          LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
            AND c.cod_agent::text = ANY($1::varchar[])
            AND EXISTS (
              SELECT 1 FROM campaign_sessions cs 
              WHERE cs.session_id::text = c.session_id::text
            )
          GROUP BY s.id, s.name, s.color, s.position
          ORDER BY s.position
        )
        SELECT * FROM funnel_data WHERE count > 0
      `;
      
      const params = [agentCodes, dateFrom, dateTo];
      
      try {
        const result = await externalDb.raw<{ stage_name: string; stage_color: string; position: number; count: number }>({ query, params });
        
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

// Hook para calcular o resumo/summary
export function useCampanhasSummary(filters: CampanhasFiltersState) {
  const { data: rawData = [] } = useCampanhasRaw(filters);
  const { data: previousData = [] } = useCampanhasPrevious(filters);
  const { data: platformData = [] } = useCampanhasByPlatform(filters);
  const { data: leadsData = [] } = useCampanhasLeads(filters);
  
  const summary: CampaignSummary = {
    totalCampaigns: new Set(leadsData.map(l => l.campaign_id)).size,
    totalLeads: rawData.length,
    leadsPerCampaign: leadsData.length > 0 
      ? Math.round(rawData.length / new Set(leadsData.map(l => l.campaign_id)).size) || 0
      : 0,
    conversionRate: 0, // Será calculado quando tivermos dados do CRM
    topPlatform: platformData[0]?.platform || '-',
    topPlatformLeads: platformData[0]?.total_leads || 0,
    previousTotalCampaigns: new Set(previousData.map(p => p.campaign_id)).size,
    previousTotalLeads: previousData.length,
  };
  
  return summary;
}
