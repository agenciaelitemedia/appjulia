import { useQuery } from '@tanstack/react-query';
import { externalDb, InactiveSession } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useState } from 'react';

export function useInactiveLeads() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Get agent codes from user
  const agentCodes = useMemo(() => {
    if (!user) return [];
    const codes: string[] = [];
    if (user.agents && Array.isArray(user.agents)) {
      user.agents.forEach((a: any) => {
        if (a.cod_agent) codes.push(String(a.cod_agent));
      });
    }
    return codes;
  }, [user]);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['inactive-sessions', agentCodes],
    queryFn: () => externalDb.getInactiveSessions(agentCodes),
    enabled: agentCodes.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter((lead: InactiveSession) =>
      (lead.contact_name && lead.contact_name.toLowerCase().includes(q)) ||
      lead.whatsapp_number.includes(q) ||
      (lead.stage_name && lead.stage_name.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  return {
    leads: filteredLeads,
    allLeads: leads,
    isLoading,
    searchQuery,
    setSearchQuery,
    refetch,
    agentCodes,
  };
}
