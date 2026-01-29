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
}

export function useAgentsList() {
  return useQuery({
    queryKey: ['agents-list'],
    queryFn: () => externalDb.getAgentsList<AgentListItem>(),
    staleTime: 60000, // 1 minute cache
    refetchOnWindowFocus: false,
  });
}
