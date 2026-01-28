import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CRMFunnelData, 
  CRMAvgTimeData, 
  CRMAgentPerformance, 
  CRMDailyTrend,
  CRMFiltersState 
} from '../types';

export function useCRMFunnelData(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-funnel', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMFunnelData & { count: string }>({
        query: `
          SELECT 
            s.id, s.name, s.color, s.position,
            COUNT(c.id)::int as count
          FROM crm_atendimento_stages s
          LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
            AND c.cod_agent = ANY($1::varchar[])
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          WHERE s.is_active = true
          GROUP BY s.id, s.name, s.color, s.position
          ORDER BY s.position
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      
      const total = result.reduce((sum, item) => sum + Number(item.count), 0);
      
      return result.map(item => ({
        ...item,
        count: Number(item.count),
        percentage: total > 0 ? (Number(item.count) / total) * 100 : 0,
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMAvgTimeByStage(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-avg-time', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMAvgTimeData & { avg_days: string }>({
        query: `
          SELECT 
            s.id, s.name, s.color, s.position,
            COALESCE(
              AVG(
                EXTRACT(EPOCH FROM (COALESCE(c.updated_at, NOW()) - c.stage_entered_at)) / 86400
              ), 
              0
            ) as avg_days
          FROM crm_atendimento_stages s
          LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
            AND c.cod_agent = ANY($1::varchar[])
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          WHERE s.is_active = true
          GROUP BY s.id, s.name, s.color, s.position
          ORDER BY s.position
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      
      return result.map(item => ({
        ...item,
        avg_days: Math.max(0, Number(item.avg_days)),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMAgentPerformance(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-agent-performance', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      // Get the "Contrato Assinado" stage ID for conversion calculation
      const result = await externalDb.raw<CRMAgentPerformance>({
        query: `
          WITH conversion_stage AS (
            SELECT id FROM crm_atendimento_stages WHERE name = 'Contrato Assinado' LIMIT 1
          )
          SELECT 
            c.cod_agent,
            COALESCE(a.owner_name, c.cod_agent) as owner_name,
            COUNT(c.id)::int as total_leads,
            COUNT(CASE WHEN c.stage_id = (SELECT id FROM conversion_stage) THEN 1 END)::int as converted_leads,
            CASE 
              WHEN COUNT(c.id) > 0 
              THEN (COUNT(CASE WHEN c.stage_id = (SELECT id FROM conversion_stage) THEN 1 END)::float / COUNT(c.id)) * 100
              ELSE 0
            END as conversion_rate,
            COALESCE(
              AVG(EXTRACT(EPOCH FROM (COALESCE(c.updated_at, NOW()) - c.created_at)) / 86400),
              0
            ) as avg_time_days
          FROM crm_atendimento_cards c
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.cod_agent = ANY($1::varchar[])
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          GROUP BY c.cod_agent, a.owner_name
          ORDER BY total_leads DESC
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      
      return result.map(item => ({
        ...item,
        total_leads: Number(item.total_leads),
        converted_leads: Number(item.converted_leads),
        conversion_rate: Number(item.conversion_rate),
        avg_time_days: Number(item.avg_time_days),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMDailyTrend(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-daily-trend', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMDailyTrend>({
        query: `
          SELECT 
            (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text as date,
            COUNT(c.id)::int as count
          FROM crm_atendimento_cards c
          WHERE c.cod_agent = ANY($1::varchar[])
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          GROUP BY (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date
          ORDER BY date ASC
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      
      return result.map(item => ({
        ...item,
        count: Number(item.count),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

// Summary statistics for the dashboard
export function useCRMSummaryStats(filters: CRMFiltersState) {
  const { data: funnelData = [], isLoading: funnelLoading } = useCRMFunnelData(filters);
  const { data: avgTimeData = [], isLoading: avgTimeLoading } = useCRMAvgTimeByStage(filters);
  const { data: dailyTrend = [], isLoading: trendLoading } = useCRMDailyTrend(filters);
  
  const totalLeads = funnelData.reduce((sum, item) => sum + item.count, 0);
  
  // Find conversion stages (Contrato em Curso + Contrato Assinado)
  const contractInProgressStage = funnelData.find(s => s.name === 'Contrato em Curso');
  const contractSignedStage = funnelData.find(s => s.name === 'Contrato Assinado');
  const convertedLeads = (contractInProgressStage?.count || 0) + (contractSignedStage?.count || 0);
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  
  // Find disqualified stage
  const disqualifiedStage = funnelData.find(s => s.name === 'Desqualificado');
  const disqualifiedLeads = disqualifiedStage?.count || 0;
  const activeLeads = totalLeads - disqualifiedLeads;
  const activeRate = totalLeads > 0 ? (activeLeads / totalLeads) * 100 : 0;
  
  // Average time across all stages
  const avgTimeTotal = avgTimeData.length > 0
    ? avgTimeData.reduce((sum, item) => sum + item.avg_days, 0) / avgTimeData.length
    : 0;
  
  return {
    totalLeads,
    convertedLeads,
    conversionRate,
    activeLeads,
    disqualifiedLeads,
    activeRate,
    avgTimeTotal,
    dailyTrend,
    funnelData,
    avgTimeData,
    isLoading: funnelLoading || avgTimeLoading || trendLoading,
  };
}
