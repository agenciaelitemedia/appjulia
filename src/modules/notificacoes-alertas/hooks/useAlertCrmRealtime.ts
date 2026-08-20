import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../extend/db';

/** Mantém o CRM de Notificações atualizado em tempo real. */
export function useAlertCrmRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('alert-crm-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_crm_cards' },
        () => {
          qc.invalidateQueries({ queryKey: ['alerts', 'crm-cards'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_crm_card_actions' },
        (payload: any) => {
          const cardId = (payload?.new ?? payload?.old)?.card_id;
          qc.invalidateQueries({ queryKey: ['alerts', 'crm-cards'] });
          if (cardId) {
            qc.invalidateQueries({ queryKey: ['alerts', 'crm-card-actions', cardId] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
