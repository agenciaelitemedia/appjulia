import { useQuery } from '@tanstack/react-query';
import { externalDb, InactiveSession } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useState, useCallback } from 'react';
import { startOfDay, subDays, startOfMonth, subMonths } from 'date-fns';

export type LeadPeriod = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'last3Months';

const PAGE_SIZE = 50;

function getDateRange(period: LeadPeriod): { from: Date; to: Date } {
  const now = new Date();
  const todayStart = startOfDay(now);
  switch (period) {
    case 'today':
      return { from: todayStart, to: now };
    case 'yesterday': {
      const yStart = subDays(todayStart, 1);
      return { from: yStart, to: todayStart };
    }
    case 'last7days':
      return { from: subDays(todayStart, 7), to: now };
    case 'thisMonth':
      return { from: startOfMonth(now), to: now };
    case 'last3Months':
      return { from: subMonths(todayStart, 3), to: now };
  }
}

export function useInactiveLeads(selectedAgentCode?: string) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<LeadPeriod>('last7days');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const { data: userAgents = [] } = useQuery({
    queryKey: ['user-agents-for-support', user?.id],
    queryFn: () => externalDb.getUserAgents(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const agentCodes = useMemo(() => {
    if (selectedAgentCode) return [selectedAgentCode];
    return userAgents.map((a: any) => String(a.cod_agent));
  }, [userAgents, selectedAgentCode]);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['inactive-sessions', agentCodes],
    queryFn: () => externalDb.getInactiveSessions(agentCodes),
    enabled: agentCodes.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const filteredLeads = useMemo(() => {
    const range = getDateRange(selectedPeriod);
    let result = leads.filter((lead: InactiveSession) => {
      const updatedAt = lead.updated_at ? new Date(lead.updated_at) : null;
      if (!updatedAt) return false;
      return updatedAt >= range.from && updatedAt <= range.to;
    });

    // Owner filter
    if (ownerFilter !== 'all') {
      if (ownerFilter === 'mine') {
        result = result.filter((lead: InactiveSession) => lead.owner_name === user?.name);
      } else if (ownerFilter === 'unassigned') {
        result = result.filter((lead: InactiveSession) => !lead.owner_name);
      } else {
        result = result.filter((lead: InactiveSession) => lead.owner_name === ownerFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((lead: InactiveSession) =>
        (lead.contact_name && lead.contact_name.toLowerCase().includes(q)) ||
        lead.whatsapp_number.includes(q) ||
        (lead.stage_name && lead.stage_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [leads, searchQuery, selectedPeriod, ownerFilter, user?.name]);

  // Reset visible count when filters change
  const setSearchQueryWithReset = useCallback((q: string) => {
    setSearchQuery(q);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const setSelectedPeriodWithReset = useCallback((p: LeadPeriod) => {
    setSelectedPeriod(p);
    setVisibleCount(PAGE_SIZE);
    refetch();
  }, [refetch]);

  const setOwnerFilterWithReset = useCallback((f: string) => {
    setOwnerFilter(f);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const paginatedLeads = useMemo(
    () => filteredLeads.slice(0, visibleCount),
    [filteredLeads, visibleCount]
  );

  const hasMore = visibleCount < filteredLeads.length;

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  return {
    leads: paginatedLeads,
    totalFiltered: filteredLeads.length,
    allLeads: leads,
    isLoading,
    searchQuery,
    setSearchQuery: setSearchQueryWithReset,
    selectedPeriod,
    setSelectedPeriod: setSelectedPeriodWithReset,
    refetch,
    agentCodes,
    hasMore,
    loadMore,
  };
}
