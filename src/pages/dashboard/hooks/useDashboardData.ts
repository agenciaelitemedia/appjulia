import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPreviousPeriod } from '@/lib/dateUtils';
import type { CRMStage, CRMCard } from '@/pages/crm/types';

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

export interface RecentLead {
  id: number;
  contact_name: string;
  whatsapp_number: string;
  stage_name: string;
  stage_color: string;
  created_at: string;
  owner_name: string;
}

export interface DashboardEvolutionData {
  date: string;
  label: string;
  leads: number;
  qualified: number;
  contractsGenerated: number;
}

export interface DashboardActivity {
  id: number;
  card_id: number;
  contact_name: string;
  whatsapp_number: string;
  from_stage_name: string | null;
  from_stage_color: string | null;
  to_stage_name: string;
  to_stage_color: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}

export interface DashboardStats {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
  activeAgents: number;
}

export interface DashboardStatsPrevious {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
}

export interface DashboardFunnelData {
  id: number;
  name: string;
  color: string;
  position: number;
  count: number;
  percentage: number;
  conversions: number;
}

// Calculate percentage change between current and previous values
export function calculateChange(current: number, previous: number): {
  value: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
} {
  if (previous === 0) {
    return { 
      value: 0, 
      isPositive: true, 
      isNeutral: current === 0, 
      label: current === 0 ? '—' : 'Novo' 
    };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0,
    isNeutral: Math.abs(change) < 0.1,
    label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
  };
}

// Generate comparison tooltip text
export function getComparisonTooltip(dateFrom: string, dateTo: string): string {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(dateFrom, dateTo);
  
  const currentFromFormatted = format(parseISO(dateFrom), 'dd/MM', { locale: ptBR });
  const currentToFormatted = format(parseISO(dateTo), 'dd/MM', { locale: ptBR });
  const previousFromFormatted = format(parseISO(previousDateFrom), 'dd/MM', { locale: ptBR });
  const previousToFormatted = format(parseISO(previousDateTo), 'dd/MM', { locale: ptBR });
  
  return `Comparando ${currentFromFormatted} - ${currentToFormatted} com ${previousFromFormatted} - ${previousToFormatted}`;
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

      const [leadsResult, conversionsResult, messagesResult] = await Promise.all([
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
        
        externalDb.raw<{ total: number }>({
          query: `
            SELECT COALESCE(SUM(total_msg::int), 0) as total
            FROM vw_desempenho_julia
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          `,
          params: [agentCodes, dateFrom, dateTo],
        }).catch(() => [{ total: 0 }]),
      ]);

      return {
        totalLeads: Number(leadsResult[0]?.count) || 0,
        totalMessages: Number(messagesResult[0]?.total) || 0,
        conversions: Number(conversionsResult[0]?.count) || 0,
        activeAgents: agentCodes.length,
      };
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useDashboardStatsPrevious(filters: DashboardFiltersState) {
  const { previousDateFrom, previousDateTo } = getPreviousPeriod(filters.dateFrom, filters.dateTo);

  return useQuery({
    queryKey: ['dashboard-stats-previous', filters.agentCodes, previousDateFrom, previousDateTo],
    queryFn: async () => {
      const { agentCodes } = filters;
      
      if (agentCodes.length === 0) {
        return {
          totalLeads: 0,
          totalMessages: 0,
          conversions: 0,
        };
      }

      const [leadsResult, conversionsResult, messagesResult] = await Promise.all([
        externalDb.raw<{ count: number }>({
          query: `
            SELECT COUNT(*) as count 
            FROM crm_atendimento_cards 
            WHERE cod_agent = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          `,
          params: [agentCodes, previousDateFrom, previousDateTo],
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
          params: [agentCodes, previousDateFrom, previousDateTo],
        }).catch(() => [{ count: 0 }]),
        
        externalDb.raw<{ total: number }>({
          query: `
            SELECT COALESCE(SUM(total_msg::int), 0) as total
            FROM vw_desempenho_julia
            WHERE cod_agent::text = ANY($1::varchar[])
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          `,
          params: [agentCodes, previousDateFrom, previousDateTo],
        }).catch(() => [{ total: 0 }]),
      ]);

      return {
        totalLeads: Number(leadsResult[0]?.count) || 0,
        totalMessages: Number(messagesResult[0]?.total) || 0,
        conversions: Number(conversionsResult[0]?.count) || 0,
      };
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useRecentLeads(filters: DashboardFiltersState) {
  return useQuery({
    queryKey: ['dashboard-recent-leads', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];

      const result = await externalDb.raw<RecentLead>({
        query: `
          SELECT 
            c.id,
            c.contact_name,
            c.whatsapp_number,
            s.name as stage_name,
            s.color as stage_color,
            c.created_at,
            a.owner_name
          FROM crm_atendimento_cards c
          JOIN crm_atendimento_stages s ON c.stage_id = s.id
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.cod_agent = ANY($1::varchar[])
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ORDER BY c.created_at DESC
          LIMIT 5
        `,
        params: [agentCodes, dateFrom, dateTo],
      });

      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useDashboardEvolution(filters: DashboardFiltersState) {
  const isSingleDay = filters.dateFrom === filters.dateTo;

  return useQuery({
    queryKey: ['dashboard-evolution', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];

      if (isSingleDay) {
        // Hourly granularity for single day
        const result = await externalDb.raw<{ hour: number; leads: number; qualified: number; contracts_generated: number }>({
          query: `
            WITH qualified_stages AS (
              SELECT id FROM crm_atendimento_stages 
              WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
            ),
            contracts_generated_stage AS (
              SELECT id FROM crm_atendimento_stages 
              WHERE name = 'Contrato em Curso'
            )
            SELECT 
              EXTRACT(HOUR FROM c.created_at AT TIME ZONE 'America/Sao_Paulo')::int as hour,
              COUNT(*) as leads,
              COUNT(CASE WHEN c.stage_id IN (SELECT id FROM qualified_stages) 
                OR EXISTS (
                  SELECT 1 FROM crm_atendimento_history h 
                  WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM qualified_stages)
                ) THEN 1 END) as qualified,
              COUNT(CASE WHEN c.stage_id IN (SELECT id FROM contracts_generated_stage)
                OR EXISTS (
                  SELECT 1 FROM crm_atendimento_history h 
                  WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM contracts_generated_stage)
                ) THEN 1 END) as contracts_generated
            FROM crm_atendimento_cards c
            WHERE c.cod_agent = ANY($1::varchar[])
              AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date
            GROUP BY EXTRACT(HOUR FROM c.created_at AT TIME ZONE 'America/Sao_Paulo')
            ORDER BY hour ASC
          `,
          params: [agentCodes, dateFrom],
        });

        // Fill all 24 hours
        const hourMap = new Map(result.map(r => [r.hour, r]));
        const chartData: DashboardEvolutionData[] = [];
        for (let h = 0; h < 24; h++) {
          const existing = hourMap.get(h);
          chartData.push({
            date: String(h),
            label: `${String(h).padStart(2, '0')}h`,
            leads: Number(existing?.leads) || 0,
            qualified: Number(existing?.qualified) || 0,
            contractsGenerated: Number(existing?.contracts_generated) || 0,
          });
        }
        return chartData;
      } else {
        // Daily granularity
        const result = await externalDb.raw<{ date: string; leads: number; qualified: number; contracts_generated: number }>({
          query: `
            WITH qualified_stages AS (
              SELECT id FROM crm_atendimento_stages 
              WHERE name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
            ),
            contracts_generated_stage AS (
              SELECT id FROM crm_atendimento_stages 
              WHERE name = 'Contrato em Curso'
            )
            SELECT 
              (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text as date,
              COUNT(*) as leads,
              COUNT(CASE WHEN c.stage_id IN (SELECT id FROM qualified_stages) 
                OR EXISTS (
                  SELECT 1 FROM crm_atendimento_history h 
                  WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM qualified_stages)
                ) THEN 1 END) as qualified,
              COUNT(CASE WHEN c.stage_id IN (SELECT id FROM contracts_generated_stage)
                OR EXISTS (
                  SELECT 1 FROM crm_atendimento_history h 
                  WHERE h.card_id = c.id AND h.to_stage_id IN (SELECT id FROM contracts_generated_stage)
                ) THEN 1 END) as contracts_generated
            FROM crm_atendimento_cards c
            WHERE c.cod_agent = ANY($1::varchar[])
              AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
              AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
            GROUP BY (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date
            ORDER BY date ASC
          `,
          params: [agentCodes, dateFrom, dateTo],
        });

        return result.map(r => ({
          date: r.date,
          label: format(new Date(r.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
          leads: Number(r.leads) || 0,
          qualified: Number(r.qualified) || 0,
          contractsGenerated: Number(r.contracts_generated) || 0,
        }));
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useDashboardActivity(filters: DashboardFiltersState) {
  return useQuery({
    queryKey: ['dashboard-activity', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];

      const result = await externalDb.raw<DashboardActivity>({
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
            AND (h.changed_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (h.changed_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ORDER BY h.changed_at DESC
          LIMIT 10
        `,
        params: [agentCodes, dateFrom, dateTo],
      });

      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useDashboardStages() {
  return useQuery({
    queryKey: ['dashboard-stages'],
    queryFn: async () => {
      const result = await externalDb.raw<CRMStage>({
        query: `
          SELECT id, name, color, position, is_active
          FROM crm_atendimento_stages
          WHERE is_active = true
          ORDER BY position ASC
        `,
      });
      return result;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useDashboardCardDetails(cardId: number | null) {
  return useQuery({
    queryKey: ['dashboard-card-details', cardId],
    queryFn: async () => {
      if (!cardId) return null;
      
      const result = await externalDb.raw<CRMCard>({
        query: `
          SELECT 
            c.id, c.helena_count_id, c.cod_agent, c.contact_name, 
            c.whatsapp_number, c.business_name, c.stage_id, c.notes,
            c.created_at, c.updated_at, c.stage_entered_at,
            s.name as stage_name, s.color as stage_color,
            a.owner_name, a.owner_business_name
          FROM crm_atendimento_cards c
          JOIN crm_atendimento_stages s ON c.stage_id = s.id
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.id = $1
        `,
        params: [cardId],
      });

      return result[0] || null;
    },
    enabled: cardId !== null,
  });
}

export function useDashboardFunnel(filters: DashboardFiltersState) {
  return useQuery({
    queryKey: ['dashboard-funnel', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<Omit<DashboardFunnelData, 'percentage'>>({
        query: `
          SELECT 
            s.id, s.name, s.color, s.position,
            COUNT(c.id)::int as count
          FROM crm_atendimento_stages s
          LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
            AND c.cod_agent = ANY($1::varchar[])
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
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
