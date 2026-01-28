import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { CRMCard, CRMStage, CRMHistory, CRMAgent, CRMFiltersState } from '../types';

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
            a.owner_name, a.owner_business_name
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
      // 1. Buscar card atual com whatsapp e stage
      const cards = await externalDb.raw<{ 
        stage_id: number; 
        whatsapp_number: string;
        cod_agent: string;
      }>({
        query: `
          SELECT c.stage_id, c.whatsapp_number, c.cod_agent
          FROM crm_atendimento_cards c
          WHERE c.id = $1
        `,
        params: [cardId],
      });
      
      const card = cards[0];
      if (!card) throw new Error('Card não encontrado');
      
      // 2. Buscar stages de contrato (por nome para ser resiliente a mudanças de ID)
      const stages = await externalDb.raw<{ id: number; name: string }>({
        query: `
          SELECT id, name FROM crm_atendimento_stages 
          WHERE name IN ('Contrato em Curso', 'Contrato Assinado')
        `,
        params: [],
      });
      
      const contratoEmCursoId = stages.find(s => s.name === 'Contrato em Curso')?.id;
      const contratoAssinadoId = stages.find(s => s.name === 'Contrato Assinado')?.id;
      
      // 3. Se está em "Contrato em Curso", verificar se pode mover
      if (card.stage_id === contratoEmCursoId && toStageId !== contratoAssinadoId) {
        // Verificar se tem contrato gerado
        const contracts = await externalDb.raw<{ count: string }>({
          query: `
            SELECT COUNT(*) as count
            FROM vw_desempenho_julia_contratos 
            WHERE whatsapp = $1 
              AND cod_agent = $2
              AND status_document IN ('CREATED', 'PENDING', 'SIGNED')
          `,
          params: [card.whatsapp_number, card.cod_agent],
        });
        
        if (parseInt(contracts[0]?.count || '0', 10) > 0) {
          throw new Error(
            'Este lead possui contrato gerado e só pode ser movido para "Contrato Assinado"'
          );
        }
      }
      
      // 4. Continuar com a movimentação normal
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
          from_stage_id: card.stage_id,
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
