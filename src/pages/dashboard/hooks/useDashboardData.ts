import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardAgent {
  cod_agent: string;
  owner_name: string;
  owner_business_name: string | null;
}

export interface DashboardFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
}

export function useDashboardAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-agents', user?.role, user?.cod_agent],
    queryFn: async () => {
      if (!user) return [];
      
      const query = user.role === 'admin'
        ? `SELECT DISTINCT cod_agent::text, owner_name, owner_business_name 
           FROM "vw_list_client-agents-users" 
           WHERE cod_agent IS NOT NULL
           ORDER BY owner_name`
        : `SELECT DISTINCT cod_agent::text, owner_name, owner_business_name 
           FROM "vw_list_client-agents-users" 
           WHERE cod_agent = $1`;
      
      const params = user.role === 'admin' ? [] : [user.cod_agent];
      const result = await externalDb.raw<DashboardAgent>({ query, params });
      return result;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardStats(filters: DashboardFiltersState) {
  return useQuery({
    queryKey: ['dashboard-stats', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) {
        return {
          totalLeads: 0,
          totalMessages: 0,
          conversions: 0,
          activeAgents: agentCodes.length,
        };
      }

      const [leadsResult, conversionsResult] = await Promise.all([
        externalDb.raw<{ count: number }>({
          query: `
            SELECT COUNT(*) as count 
            FROM crm_atendimento_cards 
            WHERE cod_agent = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          `,
          params: [agentCodes, dateFrom, dateTo],
        }).catch(() => [{ count: 0 }]),
        
        externalDb.raw<{ count: number }>({
          query: `
            SELECT COUNT(*) as count 
            FROM crm_atendimento_cards c 
            JOIN crm_atendimento_stages s ON c.stage_id = s.id 
            WHERE s.name = 'Contrato Assinado' 
              AND c.cod_agent = ANY($1::varchar[])
              AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          `,
          params: [agentCodes, dateFrom, dateTo],
        }).catch(() => [{ count: 0 }]),
      ]);

      return {
        totalLeads: Number(leadsResult[0]?.count) || 0,
        totalMessages: 0,
        conversions: Number(conversionsResult[0]?.count) || 0,
        activeAgents: agentCodes.length,
      };
    },
    enabled: filters.agentCodes.length > 0,
  });
}
