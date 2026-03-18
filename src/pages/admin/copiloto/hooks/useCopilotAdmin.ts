import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export interface InsightFilters {
  dateFrom?: string;
  dateTo?: string;
  codAgent?: string;
  insightType?: string;
  severity?: string;
}

export interface CopilotSettings {
  id: string;
  user_id: number;
  enabled_insight_types: string[];
  custom_prompt_suffix: string | null;
  max_insights_per_run: number;
  created_at: string;
  updated_at: string;
}

export function useCopilotAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InsightFilters>({});
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // All insights (admin view - no user_id filter)
  const insightsQuery = useQuery({
    queryKey: ['copilot-admin-insights', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('crm_copilot_insights')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters.codAgent) query = query.eq('cod_agent', filters.codAgent);
      if (filters.insightType) query = query.eq('insight_type', filters.insightType);
      if (filters.severity) query = query.eq('severity', filters.severity);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as any[], count: count ?? 0 };
    },
    enabled: !!user?.id,
  });

  // Settings
  const settingsQuery = useQuery({
    queryKey: ['copilot-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('crm_copilot_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CopilotSettings | null;
    },
    enabled: !!user?.id,
  });

  const saveSettings = useMutation({
    mutationFn: async (settings: Partial<CopilotSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const existing = settingsQuery.data;
      if (existing) {
        const { error } = await supabase
          .from('crm_copilot_settings')
          .update({ ...settings, updated_at: new Date().toISOString() } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_copilot_settings')
          .insert({ user_id: user.id, ...settings } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-settings'] });
    },
  });

  // Unique agents from insights
  const agentsQuery = useQuery({
    queryKey: ['copilot-admin-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_copilot_insights')
        .select('cod_agent');
      if (error) throw error;
      const unique = [...new Set((data ?? []).map((d: any) => d.cod_agent))];
      return unique.sort();
    },
  });

  return {
    insights: insightsQuery.data?.data ?? [],
    totalInsights: insightsQuery.data?.count ?? 0,
    isLoadingInsights: insightsQuery.isLoading,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    settings: settingsQuery.data,
    isLoadingSettings: settingsQuery.isLoading,
    saveSettings,
    agents: agentsQuery.data ?? [],
  };
}
