import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SearchType, TribunalResult, ProcessData } from '../types';
import { toast } from 'sonner';

interface SearchParams {
  type: SearchType;
  query: string;
  tribunals?: string[];
  size?: number;
}

interface SearchResponse {
  results: TribunalResult[];
  totalResults: number;
  searchedTribunals: number;
  responseTime: number;
}

export function useDataJudSearch() {
  const [results, setResults] = useState<TribunalResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchedTribunals, setSearchedTribunals] = useState(0);
  const [responseTime, setResponseTime] = useState(0);

  const searchMutation = useMutation({
    mutationFn: async ({ type, query, tribunals, size = 10 }: SearchParams): Promise<SearchResponse> => {
      const actionMap: Record<SearchType, string> = {
        process_number: 'search_by_number',
        document: 'search_by_document',
        lawyer: 'search_by_lawyer',
      };

      const { data, error } = await supabase.functions.invoke('datajud-search', {
        body: {
          action: actionMap[type],
          query,
          tribunals,
          size,
        },
      });

      if (error) throw error;
      return data as SearchResponse;
    },
    onSuccess: (data) => {
      setResults(data.results);
      setTotalResults(data.totalResults);
      setSearchedTribunals(data.searchedTribunals);
      setResponseTime(data.responseTime);
      
      if (data.totalResults === 0) {
        toast.info('Nenhum processo encontrado', {
          description: 'Tente ajustar os termos de busca ou selecionar tribunais específicos',
        });
      } else {
        toast.success(`${data.totalResults} processo(s) encontrado(s)`, {
          description: `Busca em ${data.searchedTribunals} tribunais (${(data.responseTime / 1000).toFixed(1)}s)`,
        });
      }
    },
    onError: (error) => {
      console.error('Search error:', error);
      toast.error('Erro na busca', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const search = useCallback(
    (params: SearchParams) => {
      if (!params.query.trim()) {
        toast.warning('Digite um termo para buscar');
        return;
      }
      searchMutation.mutate(params);
    },
    [searchMutation]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setTotalResults(0);
    setSearchedTribunals(0);
    setResponseTime(0);
  }, []);

  return {
    search,
    clearResults,
    results,
    totalResults,
    searchedTribunals,
    responseTime,
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
  };
}

// Hook for getting process movements
export function useProcessMovements() {
  return useMutation({
    mutationFn: async ({ processNumber, tribunal }: { processNumber: string; tribunal: string }) => {
      const { data, error } = await supabase.functions.invoke('datajud-search', {
        body: {
          action: 'get_movements',
          processNumber,
          tribunals: [tribunal],
        },
      });

      if (error) throw error;
      return data as { movements: ProcessData['movimentos']; process: ProcessData | null };
    },
  });
}
