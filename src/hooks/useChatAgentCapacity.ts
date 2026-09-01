/**
 * Carga real (chat_agent_live_load) + teto (chat_agent_capacity) por atendente.
 * Usado na UI para mostrar "atual/teto" e desabilitar quem está cheio.
 * Chave do mapa = identificador canônico do atendente (user_id em string).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_MAX_CONCURRENT, fetchLiveLoads } from '@/lib/chat/capacity';

export interface AgentCapacityRow {
  load: number;
  max_concurrent: number;
  is_active: boolean;
  full: boolean;
}

export function useChatAgentCapacity(enabled = true) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<Record<string, AgentCapacityRow>>({
    queryKey: ['chat-agent-capacity-load', clientId],
    enabled: enabled && !!clientId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [loads, capsRes] = await Promise.all([
        fetchLiveLoads(clientId),
        supabase
          .from('chat_agent_capacity')
          .select('agent_identifier, max_concurrent, is_active')
          .eq('client_id', clientId),
      ]);
      if (capsRes.error) throw capsRes.error;

      const out: Record<string, AgentCapacityRow> = {};
      const put = (id: string, max: number, active: boolean) => {
        const load = loads[id] ?? 0;
        out[id] = { load, max_concurrent: max, is_active: active, full: active && load >= max };
      };

      for (const c of (capsRes.data ?? []) as Array<{
        agent_identifier: string;
        max_concurrent: number | null;
        is_active: boolean | null;
      }>) {
        put(
          String(c.agent_identifier),
          Number(c.max_concurrent) || DEFAULT_MAX_CONCURRENT,
          c.is_active !== false,
        );
      }
      // Sem registro de capacidade => teto padrão (nunca ilimitado).
      for (const id of Object.keys(loads)) {
        if (!out[id]) put(id, DEFAULT_MAX_CONCURRENT, true);
      }
      return out;
    },
  });
}
