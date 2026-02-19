import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { CRMCard, CRMStage, CRMHistory, CRMAgent, CRMFiltersState } from '../types';

// Hook to get Julia sessions count for CRM dashboard
export function useCRMJuliaSessions(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-julia-sessions', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return { totalSessions: 0, dailyAverage: 0 };

      try {
        const result = await externalDb.raw<{ total_sessions: string; daily_average: string }>({
          query: `
            WITH sessions_data AS (
              SELECT 
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) as total_days
              FROM vw_painelv2_desempenho_julia
              WHERE cod_agent::text = ANY($1::varchar[])
                AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
                AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
            )
            SELECT 
              total_sessions,
              CASE WHEN total_days > 0 THEN total_sessions::float / total_days ELSE 0 END as daily_average
            FROM sessions_data
          `,
          params: [agentCodes, dateFrom, dateTo],
        });
        
        return {
          totalSessions: Number(result[0]?.total_sessions ?? 0),
          dailyAverage: Number(result[0]?.daily_average ?? 0),
        };
      } catch (err) {
        // Avoid blank screens if the external view/schema changes temporarily.
        console.error('[CRM] Failed to load Julia sessions:', err);
        return { totalSessions: 0, dailyAverage: 0 };
      }
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMStages() {
  return useQuery({
    queryKey: ['crm-stages'],
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
    staleTime: 1000 * 60 * 5,
  });
}

export function useCRMAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['crm-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await externalDb.getCrmAgentsForUser<CRMAgent>(user.id);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCRMCards(filters: CRMFiltersState) {
  return useQuery({
    queryKey: ['crm-cards', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<CRMCard>({
        query: `
          SELECT 
            c.id, c.helena_count_id, c.cod_agent, c.contact_name, c.whatsapp_number, 
            c.business_name, c.stage_id, c.notes,
            c.created_at, c.updated_at, c.stage_entered_at,
            s.name as stage_name, s.color as stage_color,
            a.owner_name, a.owner_business_name,
            EXISTS (
              SELECT 1 FROM crm_atendimento_history h
              JOIN crm_atendimento_stages hs ON h.to_stage_id = hs.id
              WHERE h.card_id = c.id 
                AND hs.name IN ('Contrato em Curso', 'Contrato Assinado')
            ) OR s.name IN ('Contrato em Curso', 'Contrato Assinado') as has_contract_history
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          LEFT JOIN "vw_list_client-agents-users" a ON c.cod_agent = a.cod_agent::text
          WHERE c.cod_agent = ANY($1::varchar[])
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
            AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
          ORDER BY c.stage_entered_at DESC
        `,
        params: [agentCodes, dateFrom, dateTo],
      });
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useCRMCardHistory(cardId: number | null) {
  return useQuery({
    queryKey: ['crm-card-history', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      
      const result = await externalDb.raw<CRMHistory>({
        query: `
          SELECT 
            h.id, h.card_id, h.from_stage_id, h.to_stage_id,
            h.changed_by, h.changed_at, h.notes,
            fs.name as from_stage_name, fs.color as from_stage_color,
            ts.name as to_stage_name, ts.color as to_stage_color
          FROM crm_atendimento_history h
          LEFT JOIN crm_atendimento_stages fs ON h.from_stage_id = fs.id
          LEFT JOIN crm_atendimento_stages ts ON h.to_stage_id = ts.id
          WHERE h.card_id = $1
          ORDER BY h.changed_at DESC
        `,
        params: [cardId],
      });
      return result;
    },
    enabled: !!cardId,
  });
}

export function useMoveCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ cardId, toStageId, notes }: { cardId: number; toStageId: number; notes?: string }) => {
      const cards = await externalDb.raw<{ stage_id: number }>({
        query: 'SELECT stage_id FROM crm_atendimento_cards WHERE id = $1',
        params: [cardId],
      });
      
      const fromStageId = cards[0]?.stage_id;
      
      await externalDb.update({
        table: 'crm_atendimento_cards',
        data: {
          stage_id: toStageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        where: { id: cardId },
      });
      
      await externalDb.insert({
        table: 'crm_atendimento_history',
        data: {
          card_id: cardId,
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          changed_by: user?.name || 'Sistema',
          changed_at: new Date().toISOString(),
          notes: notes || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-cards'] });
      queryClient.invalidateQueries({ queryKey: ['crm-card-history'] });
    },
  });
}
