import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { CRMCard, CRMStage, CRMHistory } from '../types';

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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCRMCards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['crm-cards', user?.cod_agent],
    queryFn: async () => {
      if (!user?.cod_agent) return [];
      
      const result = await externalDb.raw<CRMCard>({
        query: `
          SELECT 
            c.id, c.cod_agent, c.contact_name, c.whatsapp_number, 
            c.business_name, c.stage_id, c.notes,
            c.created_at, c.updated_at, c.stage_entered_at,
            s.name as stage_name, s.color as stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.cod_agent = $1
          ORDER BY c.stage_entered_at DESC
        `,
        params: [user.cod_agent],
      });
      return result;
    },
    enabled: !!user?.cod_agent,
  });
}

export function useCRMCardHistory(cardId: number | null) {
  return useQuery({
    queryKey: ['crm-card-history', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      
      const result = await externalDb.raw<CRMHistory & { from_stage_name?: string; to_stage_name?: string }>({
        query: `
          SELECT 
            h.id, h.card_id, h.from_stage_id, h.to_stage_id,
            h.changed_by, h.changed_at, h.notes,
            fs.name as from_stage_name,
            ts.name as to_stage_name
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
      // Get current stage
      const cards = await externalDb.raw<{ stage_id: number }>({
        query: 'SELECT stage_id FROM crm_atendimento_cards WHERE id = $1',
        params: [cardId],
      });
      
      const fromStageId = cards[0]?.stage_id;
      
      // Update card stage
      await externalDb.update({
        table: 'crm_atendimento_cards',
        data: {
          stage_id: toStageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        where: { id: cardId },
      });
      
      // Insert history record
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
