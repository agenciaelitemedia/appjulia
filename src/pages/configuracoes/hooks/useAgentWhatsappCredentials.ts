import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

export interface AgentWhatsappCredentials {
  hub: string | null;
  evo_url: string | null;
  evo_apikey: string | null;
}

/**
 * Fetches the WhatsApp credentials (hub + UaZapi url/token) of a single agent
 * by cod_agent. Used by the sync wizard to ensure warmup/import use the
 * agent's own WhatsApp instance (not the queue admin token).
 */
export function useAgentWhatsappCredentials(codAgent: string | null | undefined) {
  return useQuery<AgentWhatsappCredentials | null>({
    queryKey: ['agent-whatsapp-credentials', codAgent],
    enabled: !!codAgent,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const rows = await externalDb.raw<AgentWhatsappCredentials>({
        query:
          'SELECT hub, evo_url, evo_apikey FROM agents WHERE cod_agent = $1 LIMIT 1',
        params: [codAgent!],
      });
      return rows?.[0] ?? null;
    },
  });
}