/**
 * Carga real por atendente, na MESMA regra da lista de conversas:
 * apenas conversas em atendimento (`open`), não adiadas (snooze) e nas filas
 * que o atendente enxerga. Independe da distribuição automática estar ativa
 * (diferente de useChatAgentCapacity, que só devolve quem tem teto em vigor).
 *
 * Use este hook em qualquer UI que precise mostrar "carga/limite" — nunca a
 * coluna espelho chat_agent_capacity.current_load, que ignora filas.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLiveLoadsDetailed, type LiveLoadBreakdown } from '@/lib/chat/capacity';

export type { LiveLoadBreakdown };

export function useChatLiveLoads(enabled = true) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery<Record<string, LiveLoadBreakdown>>({
    queryKey: ['chat-live-loads', clientId],
    enabled: enabled && !!clientId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: () => fetchLiveLoadsDetailed(clientId),
  });
}
