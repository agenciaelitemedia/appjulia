import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CRMStuckLead, 
  CRMActivityLog, 
  CRMAgentWorkload, 
  CRMStageBottleneck,
  CRMFiltersState 
} from '../types';

export function useCRMStuckLeads(filters: CRMFiltersState, daysThreshold: number = 7) {
  return useQuery({
    queryKey: ['crm-stuck-leads', filters, daysThreshold],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMStuckLead>({
        query: `
          SELECT 
            c.id, c.helena_count_id, c.cod_agent, c.contact_name, c.whatsapp_number,
            c.business_name, c.stage_id, c.notes,
            c.created_at, c.updated_at, c.stage_entered_at,
            s.name as stage_name, s.color as stage_color,
            a.owner_name, a.owner_business_name,
            EXTRACT(DAY FROM NOW() - c.stage_entered_at)::int as days_stuck
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.cod_agent = ANY($1::varchar[])
            AND NOW() - c.stage_entered_at > ($2 || ' days')::interval
            AND s.name NOT IN ('Contrato Assinado', 'Desqualificado')
          ORDER BY days_stuck DESC
          LIMIT 50
        `,
        params: [agentCodes, daysThreshold],
      });
      
      return result.map(item => ({
        ...item,
        days_stuck: Number(item.days_stuck),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMRecentActivity(filters: CRMFiltersState, limit: number = 50) {
  return useQuery({
    queryKey: ['crm-recent-activity', filters, limit],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMActivityLog>({
        query: `
          SELECT 
            h.id, h.card_id, h.changed_by, h.changed_at, h.notes,
            fs.name as from_stage_name, fs.color as from_stage_color,
            ts.name as to_stage_name, ts.color as to_stage_color,
            c.contact_name, c.whatsapp_number
          FROM crm_atendimento_history h
          LEFT JOIN crm_atendimento_stages fs ON h.from_stage_id = fs.id
          LEFT JOIN crm_atendimento_stages ts ON h.to_stage_id = ts.id
          LEFT JOIN crm_atendimento_cards c ON h.card_id = c.id
          WHERE c.cod_agent = ANY($1::varchar[])
          ORDER BY h.changed_at DESC
          LIMIT $2
        `,
        params: [agentCodes, limit],
      });
      
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMAgentWorkload(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-agent-workload', filters],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMAgentWorkload>({
        query: `
          SELECT 
            c.cod_agent,
            COALESCE(a.owner_name, c.cod_agent) as owner_name,
            COUNT(CASE WHEN s.name NOT IN ('Contrato Assinado', 'Desqualificado') THEN 1 END)::int as active_leads,
            COUNT(CASE WHEN NOW() - c.stage_entered_at > INTERVAL '7 days' 
              AND s.name NOT IN ('Contrato Assinado', 'Desqualificado') THEN 1 END)::int as stuck_leads
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.cod_agent = ANY($1::varchar[])
          GROUP BY c.cod_agent, a.owner_name
          ORDER BY active_leads DESC
        `,
        params: [agentCodes],
      });
      
      return result.map(item => ({
        ...item,
        active_leads: Number(item.active_leads),
        stuck_leads: Number(item.stuck_leads),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMStageBottlenecks(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-stage-bottlenecks', filters],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMStageBottleneck & { avg_count: string }>({
        query: `
          WITH stage_counts AS (
            SELECT 
              s.id, s.name, s.color, s.position,
              COUNT(c.id)::int as count
            FROM crm_atendimento_stages s
            LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
              AND c.cod_agent = ANY($1::varchar[])
            WHERE s.is_active = true
              AND s.name NOT IN ('Contrato Assinado', 'Desqualificado')
            GROUP BY s.id, s.name, s.color, s.position
          ),
          avg_count AS (
            SELECT AVG(count) as avg_count FROM stage_counts
          )
          SELECT 
            sc.*,
            ac.avg_count,
            sc.count > (ac.avg_count * 1.3) as is_bottleneck
          FROM stage_counts sc
          CROSS JOIN avg_count ac
          ORDER BY sc.count DESC
        `,
        params: [agentCodes],
      });
      
      return result.map(item => ({
        ...item,
        count: Number(item.count),
        avg_count: Number(item.avg_count),
        is_bottleneck: Boolean(item.is_bottleneck),
      }));
    },
    enabled: filters.agentCodes.length > 0,
  });
}
