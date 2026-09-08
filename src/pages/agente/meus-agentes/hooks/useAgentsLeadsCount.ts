import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

interface LeadsRow {
  cod_agent: string;
  leads_received: number | string;
}

/**
 * Contagem de "Leads do mês" por agente.
 * Query separada da lista de agentes para que os cartões apareçam
 * imediatamente, sem esperar a agregação em log_messages.
 */
export function useAgentsLeadsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-agents-leads', user?.id],
    queryFn: async () => {
      const rows = await externalDb.getUserAgentsLeads<LeadsRow>(Number(user!.id));
      const map = new Map<string, number>();
      (rows || []).forEach((r) => map.set(String(r.cod_agent), Number(r.leads_received) || 0));
      return map;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
