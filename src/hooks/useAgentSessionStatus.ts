import { useQuery, useQueryClient } from '@tanstack/react-query';
import { externalDb, SessionStatus } from '@/lib/externalDb';

/**
 * Shared cache for agent session status by cod_agent.
 * All components using the same cod_agent share a single request,
 * reducing duplicate calls across CRM cards.
 */
export function useAgentSessionStatus(
  whatsappNumber: string | undefined | null,
  codAgent: string | undefined | null
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['agent-session-status', codAgent, whatsappNumber],
    queryFn: async (): Promise<SessionStatus | null> => {
      if (!whatsappNumber || !codAgent) return null;
      return externalDb.getSessionStatus(whatsappNumber, codAgent);
    },
    enabled: !!whatsappNumber && !!codAgent,
    staleTime: 60_000,       // 1 min cache
    gcTime: 5 * 60_000,      // 5 min garbage collection
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const invalidate = () => {
    if (codAgent) {
      queryClient.invalidateQueries({ queryKey: ['agent-session-status', codAgent] });
    }
  };

  return {
    isActive: query.data?.active ?? null,
    session: query.data,
    isLoading: query.isLoading,
    invalidate,
  };
}
