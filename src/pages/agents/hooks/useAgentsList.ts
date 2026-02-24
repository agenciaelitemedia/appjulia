import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';

export interface AgentListItem {
  id: number;
  cod_agent: string;
  status: boolean;
  settings: Record<string, unknown> | null;
  client_name: string;
  business_name: string;
  plan_name: string | null;
  plan_limit: number;
  leads_received: number;
  last_used: number | string | null;
  due_date: number | string | null;
  user_agent_id: number | null;
}

export function useAgentsList(showLegacy: boolean = false, showAll: boolean = false) {
  return useQuery({
    queryKey: ['agents-list', showLegacy, showAll],
    queryFn: () => externalDb.getAgentsList<AgentListItem>(showLegacy, showAll),
    staleTime: 60000, // 1 minute cache
    refetchOnWindowFocus: false,
  });
}
