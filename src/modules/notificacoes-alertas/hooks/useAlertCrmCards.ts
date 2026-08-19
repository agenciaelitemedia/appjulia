import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { AlertCrmCard, AlertCrmCardAction, AlertCrmCardStatus } from '../types';

const CARDS = 'alert_crm_cards';
const ACTIONS = 'alert_crm_card_actions';

export interface AlertCrmCardsFilters {
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
}

/** Cards do CRM de Notificações no período/agentes selecionados (todos os status). */
export function useAlertCrmCards(filters: AlertCrmCardsFilters) {
  return useQuery({
    queryKey: ['alerts', 'crm-cards', filters],
    staleTime: 30_000,
    queryFn: async () => {
      let query = (supabase as any)
        .from(CARDS)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(2000);

      if (filters.agentCodes.length > 0) query = query.in('cod_agent', filters.agentCodes);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AlertCrmCard[];
    },
  });
}

/** Timeline de ações de recuperação de um card. */
export function useAlertCrmCardActions(cardId: string | null) {
  return useQuery({
    queryKey: ['alerts', 'crm-card-actions', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(ACTIONS)
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AlertCrmCardAction[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (cardId?: string) => {
    qc.invalidateQueries({ queryKey: ['alerts', 'crm-cards'] });
    if (cardId) qc.invalidateQueries({ queryKey: ['alerts', 'crm-card-actions', cardId] });
  };
}

export function useAddAlertCrmCardAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      cardId: string;
      actionText: string;
      userName?: string | null;
      userId?: string | null;
    }) => {
      const { error } = await (supabase as any).from(ACTIONS).insert({
        card_id: input.cardId,
        action_text: input.actionText,
        created_by_name: input.userName ?? null,
        created_by_id: input.userId ? String(input.userId) : null,
      });
      if (error) throw error;
      await (supabase as any)
        .from(CARDS)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.cardId);
    },
    onSuccess: (_data, vars) => invalidate(vars.cardId),
  });
}

export function useResolveAlertCrmCard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      cardId: string;
      status: Extract<AlertCrmCardStatus, 'recovered' | 'lost'>;
      userName?: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from(CARDS)
        .update({
          status: input.status,
          resolved_at: new Date().toISOString(),
          resolved_by: input.userName ?? null,
        })
        .eq('id', input.cardId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(vars.cardId),
  });
}

export function useDeleteAlertCrmCard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await (supabase as any).from(CARDS).delete().eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}
