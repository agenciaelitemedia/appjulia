import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChatSlaConfigs, evaluateSla } from '@/hooks/useChatSlaConfigs';

export interface GlobalSlaStats {
  total: number;
  on_track: number;
  at_risk: number;
  breached: number;
  oldest_breached: {
    conversation_id: string;
    client_id: string;
    minutes_overdue: number;
    label: string;
  } | null;
}

/**
 * Agrega SLA de TODAS as conversas abertas/pendentes (cross-client).
 * Aplica evaluateSla no client em batch — para 10k+ conversas, considerar
 * mover para uma view materializada.
 */
export function useGlobalSlaStats() {
  const { configs } = useChatSlaConfigs();

  return useQuery<GlobalSlaStats>({
    queryKey: ['tv-global-sla-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, client_id, status, priority, opened_at, first_response_at, resolved_at, closed_at')
        .in('status', ['pending', 'open']);

      if (error || !data) {
        return { total: 0, on_track: 0, at_risk: 0, breached: 0, oldest_breached: null };
      }

      let on_track = 0, at_risk = 0, breached = 0;
      let oldest: GlobalSlaStats['oldest_breached'] = null;

      for (const c of data) {
        const ev = evaluateSla(c as any, configs ?? []);
        if (ev.status === 'on_track') on_track++;
        else if (ev.status === 'at_risk') at_risk++;
        else if (ev.status === 'breached') {
          breached++;
          const overdue = -ev.remainingMinutes; // remainingMinutes é negativo quando breached
          if (!oldest || overdue > oldest.minutes_overdue) {
            oldest = {
              conversation_id: (c as any).id,
              client_id: (c as any).client_id,
              minutes_overdue: overdue,
              label: ev.label,
            };
          }
        }
      }

      return { total: data.length, on_track, at_risk, breached, oldest_breached: oldest };
    },
    refetchInterval: 30 * 1000, // 30s
    enabled: !!configs,
  });
}
