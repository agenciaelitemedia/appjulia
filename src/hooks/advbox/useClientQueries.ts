import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AdvboxClientQuery } from '@/types/advbox';

export interface ClientQueriesFilters {
  query_type?: string;
  client_phone?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface ClientQueriesStats {
  total_queries: number;
  avg_response_time_ms: number;
  avg_processes_found: number;
  queries_with_results: number;
  queries_without_results: number;
}

interface ClientQueriesState {
  queries: AdvboxClientQuery[];
  total: number;
  stats: ClientQueriesStats | null;
  isLoading: boolean;
}

export function useClientQueries() {
  const [state, setState] = useState<ClientQueriesState>({
    queries: [],
    total: 0,
    stats: null,
    isLoading: false,
  });

  const loadQueries = useCallback(async (codAgent: string, filters: ClientQueriesFilters = {}) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke('db-query', {
        body: {
          action: 'advbox_load_client_queries',
          cod_agent: codAgent,
          filters: {
            query_type: filters.query_type,
            client_phone: filters.client_phone,
            start_date: filters.start_date,
            end_date: filters.end_date,
            page: filters.page || 1,
            limit: filters.limit || 20,
          },
        },
      });

      if (error) throw error;

      setState({
        queries: data.queries || [],
        total: data.total || 0,
        stats: data.stats || null,
        isLoading: false,
      });

      return data;
    } catch (error) {
      console.error('Error loading client queries:', error);
      toast.error('Erro ao carregar histórico de consultas');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, []);

  return {
    queries: state.queries,
    total: state.total,
    stats: state.stats,
    isLoading: state.isLoading,
    loadQueries,
  };
}
