import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { UserAgent } from '../types';

export function useMyAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return { myAgents: [], monitoredAgents: [] };
      
      const agents = await externalDb.getUserAgents<UserAgent>(user.id);
      
      // Separar agentes próprios (agent_id preenchido) de monitorados (apenas cod_agent)
      const myAgents = agents.filter(a => a.agent_id !== null);
      const monitoredAgents = agents.filter(a => a.agent_id === null);
      
      return { myAgents, monitoredAgents };
    },
    enabled: !!user?.id,
  });
}
