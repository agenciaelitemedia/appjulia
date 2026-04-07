import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ComercialStage, ComercialCard } from '../types';

export function useCrmComercialStages() {
  return useQuery({
    queryKey: ['crm-comercial-stages'],
    queryFn: async (): Promise<ComercialStage[]> => {
      const { data, error } = await supabase
        .from('crm_comercial_stages')
        .select('*')
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

interface CardFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  agentCodes?: string[];
}

export function useCrmComercialCards(filters: CardFilters) {
  return useQuery({
    queryKey: ['crm-comercial-cards', filters],
    queryFn: async (): Promise<ComercialCard[]> => {
      let query = supabase
        .from('crm_comercial_cards')
        .select(`
          *,
          crm_comercial_stages!inner (name, color)
        `)
        .order('updated_at', { ascending: false });

      if (filters.agentCodes && filters.agentCodes.length > 0) {
        query = query.in('cod_agent', filters.agentCodes);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        stage_name: item.crm_comercial_stages?.name,
        stage_color: item.crm_comercial_stages?.color,
      }));
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateComercialCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: {
      stage_id: number;
      contact_name: string;
      contact_phone?: string;
      contact_email?: string;
      company_name?: string;
      notes?: string;
      value?: number;
      cod_agent?: string;
    }) => {
      const { data, error } = await supabase
        .from('crm_comercial_cards')
        .insert(card)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('crm_comercial_history').insert({
        card_id: data.id,
        to_stage_id: card.stage_id,
        notes: 'Card criado',
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-comercial-cards'] });
    },
  });
}

export function useUpdateComercialCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComercialCard> & { id: number }) => {
      const { data, error } = await supabase
        .from('crm_comercial_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-comercial-cards'] });
    },
  });
}

export function useMoveComercialCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, fromStageId, toStageId }: {
      cardId: number;
      fromStageId: number;
      toStageId: number;
    }) => {
      const { error } = await supabase
        .from('crm_comercial_cards')
        .update({ stage_id: toStageId, stage_entered_at: new Date().toISOString() })
        .eq('id', cardId);
      if (error) throw error;

      await supabase.from('crm_comercial_history').insert({
        card_id: cardId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-comercial-cards'] });
    },
  });
}

export function useDeleteComercialCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: number) => {
      const { error } = await supabase
        .from('crm_comercial_cards')
        .delete()
        .eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-comercial-cards'] });
    },
  });
}
